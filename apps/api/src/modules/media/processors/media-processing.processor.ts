import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { MediaStatus, MediaType } from "@prisma/client";
import sharp from "sharp";
import { PrismaService } from "../../../prisma/prisma.service";
import { StorageService } from "../lib/storage.service";

// No colons: BullMQ uses ":" as its own Redis key separator and rejects queue names containing
// one ("Queue name cannot contain :").
export const MEDIA_QUEUE = "media-processing";
export const MEDIA_PROCESSING_JOB = "process-asset";

export interface MediaProcessingJobData {
  assetId: string;
  posterStorageKey: string | null;
}

/** Longest edge, in pixels, for each generated rendition. */
const VARIANTS = [
  { label: "thumb", maxEdge: 400 },
  { label: "preview", maxEdge: 1200 },
] as const;

/**
 * Derives dimensions and renditions once an upload lands, then flips the asset to READY.
 *
 * Images only. Video deliberately gets no server-side transcode: ffmpeg would add ~100MB to the
 * node:20-alpine image for a feature we don't otherwise need, so the browser captures a poster
 * frame from <video> onto a canvas and uploads it through its own presign — see
 * `posterStorageKey`. Video width/height/duration come from the client's HTMLVideoElement.
 */
@Processor(MEDIA_QUEUE)
export class MediaProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<MediaProcessingJobData>): Promise<{ variants: number }> {
    if (job.name !== MEDIA_PROCESSING_JOB) return { variants: 0 };
    const { assetId, posterStorageKey } = job.data;

    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!asset) {
      this.logger.warn(`Asset ${assetId} vanished before processing; nothing to do.`);
      return { variants: 0 };
    }

    try {
      if (asset.type === MediaType.IMAGE) {
        const created = await this.processImage(asset.id, asset.storageKey, asset.mimeType);
        return { variants: created };
      }

      if (asset.type === MediaType.VIDEO && posterStorageKey) {
        const poster = await this.storage.presignGet(posterStorageKey);
        await this.prisma.mediaAsset.update({
          where: { id: assetId },
          data: { thumbnailUrl: poster, status: MediaStatus.READY },
        });
        return { variants: 0 };
      }

      // Video with no poster, or a document: nothing to derive, but it is still usable.
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { status: MediaStatus.READY },
      });
      return { variants: 0 };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Processing failed for asset ${assetId}: ${message}`);

      // Only mark FAILED once BullMQ has exhausted its retries; an interim failure should stay
      // PROCESSING so the UI doesn't flip to an error state that then resolves itself.
      const attemptsMade = job.attemptsMade + 1;
      if (attemptsMade >= (job.opts.attempts ?? 1)) {
        await this.prisma.mediaAsset.update({
          where: { id: assetId },
          data: { status: MediaStatus.FAILED, processingError: message.slice(0, 500) },
        });
      }
      throw err;
    }
  }

  private async processImage(
    assetId: string,
    storageKey: string,
    mimeType: string,
  ): Promise<number> {
    const original = await this.storage.getObject(storageKey);
    const metadata = await sharp(original).metadata();

    let created = 0;
    let thumbnailUrl: string | null = null;

    // Animated GIFs would lose their animation through the resize pipeline, so they keep the
    // original as their own thumbnail rather than getting a broken still.
    const isAnimated = (metadata.pages ?? 1) > 1;

    if (!isAnimated) {
      for (const variant of VARIANTS) {
        // Never upscale: a 200px logo shouldn't produce a blurry 1200px "preview".
        if ((metadata.width ?? 0) <= variant.maxEdge && (metadata.height ?? 0) <= variant.maxEdge) {
          continue;
        }

        const buffer = await sharp(original)
          .rotate() // honour EXIF orientation before resizing
          .resize(variant.maxEdge, variant.maxEdge, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true });

        const variantKey = `${storageKey}.${variant.label}.webp`;
        await this.storage.putObject(variantKey, buffer.data, "image/webp");

        await this.prisma.mediaVariant.upsert({
          where: { mediaAssetId_label: { mediaAssetId: assetId, label: variant.label } },
          create: {
            mediaAssetId: assetId,
            label: variant.label,
            storageKey: variantKey,
            url: this.storage.publicUrl(variantKey),
            width: buffer.info.width,
            height: buffer.info.height,
            sizeBytes: buffer.info.size,
            mimeType: "image/webp",
          },
          update: {
            storageKey: variantKey,
            url: this.storage.publicUrl(variantKey),
            width: buffer.info.width,
            height: buffer.info.height,
            sizeBytes: buffer.info.size,
          },
        });

        if (variant.label === "thumb") thumbnailUrl = this.storage.publicUrl(variantKey);
        created++;
      }
    }

    await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: {
        // sharp read the real bytes, so these override whatever the client reported.
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        mimeType: metadata.format ? `image/${metadata.format}` : mimeType,
        thumbnailUrl: thumbnailUrl ?? this.storage.publicUrl(storageKey),
        status: MediaStatus.READY,
        processingError: null,
      },
    });

    return created;
  }
}
