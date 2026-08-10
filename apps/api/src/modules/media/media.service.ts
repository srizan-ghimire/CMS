import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { MediaAsset, MediaStatus, MediaType, MediaVariant, Prisma } from "@prisma/client";
import {
  type BulkMediaInput,
  type CreateFolderInput,
  type FinalizeUploadInput,
  type ListMediaQuery,
  type MediaAssetDto,
  type MediaFolderDto,
  type PresignUploadInput,
  type PresignUploadResponse,
  type UpdateFolderInput,
  type UpdateMediaInput,
  mediaTypeForMime,
} from "@social-platform/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import {
  CONTENT_CREATE_ROLES,
  CONTENT_MANAGE_ROLES,
  DESTRUCTIVE_ROLES,
  VIEW_ROLES,
} from "../workspaces/lib/roles";
import { StorageService } from "./lib/storage.service";
import { MEDIA_PROCESSING_JOB, MEDIA_QUEUE } from "./processors/media-processing.processor";

type AssetTagRow = { tag: { id: string; name: string; color: string | null } };
type AssetWithVariants = MediaAsset & { variants: MediaVariant[]; tags?: AssetTagRow[] };

/** Single include so every read shapes assets identically. */
const ASSET_INCLUDE = {
  variants: true,
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
} satisfies Prisma.MediaAssetInclude;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly maxUploadBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue(MEDIA_QUEUE) private readonly queue: Queue,
  ) {
    this.maxUploadBytes = this.config.get<number>("media.maxUploadBytes") ?? 1024 * 1024 * 1024;
  }

  /* ------------------------------- Upload flow ------------------------------ */

  async presignUpload(input: PresignUploadInput, userId: string): Promise<PresignUploadResponse> {
    await this.workspaces.assertMembership(input.workspaceId, userId, CONTENT_CREATE_ROLES);

    if (input.sizeBytes > this.maxUploadBytes) {
      throw new BadRequestException(
        `File is ${Math.round(input.sizeBytes / 1024 / 1024)}MB; the limit is ${Math.round(
          this.maxUploadBytes / 1024 / 1024,
        )}MB.`,
      );
    }

    const type = mediaTypeForMime(input.mimeType);
    if (!type) throw new BadRequestException(`Unsupported file type: ${input.mimeType}`);

    if (input.folderId) await this.assertFolderInWorkspace(input.folderId, input.workspaceId);

    // Content-addressed dedupe: the same bytes uploaded twice into one workspace reuse the row
    // instead of duplicating the object in storage.
    //
    // This lookup must match @@unique([workspaceId, checksum]), which is unconditional. Narrowing
    // it to READY + non-deleted rows hides the ones that still hold the slot — above all an
    // UPLOADING row from a presign whose PUT never completed. The retry then fell through to
    // create() and died with P2002, surfacing as a 500 on every subsequent attempt at that file.
    if (input.checksum) {
      const existing = await this.findByChecksum(input.workspaceId, input.checksum);

      // Only a READY, live asset is a genuine duplicate — there are usable bytes behind it.
      if (existing && existing.status === MediaStatus.READY && !existing.deletedAt) {
        return {
          assetId: existing.id,
          storageKey: existing.storageKey,
          uploadUrl: "",
          requiredHeaders: {},
          duplicateOf: this.toDto(existing),
        };
      }

      if (existing) return this.reissueUpload(existing, input, userId, type);
    }

    const assetId = createAssetId();
    const storageKey = buildStorageKey(input.workspaceId, assetId, input.fileName);

    let asset: MediaAsset;
    try {
      asset = await this.prisma.mediaAsset.create({
        data: {
          id: assetId,
          workspaceId: input.workspaceId,
          folderId: input.folderId ?? null,
          uploadedById: userId,
          type,
          status: MediaStatus.UPLOADING,
          storageKey,
          url: this.storage.publicUrl(storageKey),
          mimeType: input.mimeType,
          fileName: input.fileName,
          sizeBytes: input.sizeBytes,
          checksum: input.checksum ?? null,
        },
      });
    } catch (err) {
      // Two presigns for the same bytes can interleave between the lookup above and this insert —
      // dropping one file twice into the batch uploader is enough. The loser gets P2002; hand it
      // the winner's row instead of a 500.
      const winner =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        input.checksum
          ? await this.findByChecksum(input.workspaceId, input.checksum)
          : null;
      if (!winner) throw err;
      return this.reissueUpload(winner, input, userId, type);
    }

    const uploadUrl = await this.storage.presignPut(storageKey, input.mimeType);

    return {
      assetId: asset.id,
      storageKey,
      uploadUrl,
      // SigV4 signs Content-Type, so the PUT must send exactly this value or storage rejects it.
      requiredHeaders: { "Content-Type": input.mimeType },
      duplicateOf: null,
    };
  }

  /** Reads the row occupying the `(workspaceId, checksum)` unique slot, whatever state it is in. */
  private findByChecksum(
    workspaceId: string,
    checksum: string,
  ): Promise<AssetWithVariants | null> {
    return this.prisma.mediaAsset.findUnique({
      where: { workspaceId_checksum: { workspaceId, checksum } },
      include: ASSET_INCLUDE,
    });
  }

  /**
   * Re-issue an upload against a row that already owns this workspace's `(workspaceId, checksum)`
   * slot but has nothing usable behind it: an abandoned UPLOADING row, a FAILED conversion, or a
   * soft-deleted asset being re-uploaded. Reviving is the only option — the unique constraint
   * leaves no way to insert alongside it, and the row cannot be hard-deleted because a PUBLISHED
   * PostTarget may reference it.
   *
   * `storageKey` is deliberately left as it is. It is the asset's stable identity, the checksum
   * already guarantees the bytes are identical, and re-keying would strand whatever object a
   * soft-deleted row still has in the bucket.
   */
  private async reissueUpload(
    existing: MediaAsset,
    input: PresignUploadInput,
    userId: string,
    type: MediaType,
  ): Promise<PresignUploadResponse> {
    const revived = await this.prisma.mediaAsset.update({
      where: { id: existing.id },
      data: {
        folderId: input.folderId ?? null,
        uploadedById: userId,
        type,
        status: MediaStatus.UPLOADING,
        mimeType: input.mimeType,
        fileName: input.fileName,
        sizeBytes: input.sizeBytes,
        processingError: null,
        uploadedAt: null,
        deletedAt: null,
      },
    });

    return {
      assetId: revived.id,
      storageKey: revived.storageKey,
      uploadUrl: await this.storage.presignPut(revived.storageKey, input.mimeType),
      requiredHeaders: { "Content-Type": input.mimeType },
      duplicateOf: null,
    };
  }

  /**
   * Step 3: confirm the bytes actually landed. Verifying with HeadObject rather than trusting the
   * client matters — a failed or truncated PUT would otherwise leave a READY asset whose URL 404s,
   * and that asset could then be attached to a post and blow up at publish time.
   */
  async finalizeUpload(
    assetId: string,
    input: FinalizeUploadInput,
    userId: string,
  ): Promise<MediaAssetDto> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null },
      include: ASSET_INCLUDE,
    });
    if (!asset) throw new NotFoundException("Media asset not found.");
    await this.workspaces.assertMembership(asset.workspaceId, userId, CONTENT_CREATE_ROLES);

    if (asset.status === MediaStatus.READY) return this.toDto(asset);

    const head = await this.storage.head(asset.storageKey);
    if (!head) {
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { status: MediaStatus.FAILED, processingError: "Upload did not complete." },
      });
      throw new BadRequestException("Upload did not complete — no object found in storage.");
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: {
        status: MediaStatus.PROCESSING,
        // Storage is authoritative on size; the presign value was only the client's claim.
        sizeBytes: head.sizeBytes,
        width: input.width ?? asset.width,
        height: input.height ?? asset.height,
        durationMs: input.durationMs ?? asset.durationMs,
        uploadedAt: new Date(),
        processingError: null,
      },
      include: ASSET_INCLUDE,
    });

    await this.queue.add(
      MEDIA_PROCESSING_JOB,
      { assetId, posterStorageKey: input.posterStorageKey ?? null },
      {
        // Deterministic id so a double finalize can't queue the same asset twice. Hyphen, not
        // colon, for the same BullMQ key-separator reason as the queue name.
        jobId: `media-process-${assetId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
      },
    );

    return this.toDto(updated);
  }

  /* --------------------------------- Reads --------------------------------- */

  async list(query: ListMediaQuery, userId: string) {
    await this.workspaces.assertMembership(query.workspaceId, userId, VIEW_ROLES);

    const where: Prisma.MediaAssetWhereInput = {
      workspaceId: query.workspaceId,
      deletedAt: null,
      ...(query.scope === "root" ? { folderId: null } : {}),
      ...(query.scope === "folder" && query.folderId ? { folderId: query.folderId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.isFavorite !== undefined ? { isFavorite: query.isFavorite } : {}),
      // Tags live in a join table, so this is an EXISTS-style relation filter rather than a
      // column match (the same reason they cannot be part of the search tsvector).
      ...(query.tagIds?.length ? { tags: { some: { tagId: { in: query.tagIds } } } } : {}),
      ...(query.search
        ? {
            OR: [
              { fileName: { contains: query.search, mode: "insensitive" as const } },
              { altText: { contains: query.search, mode: "insensitive" as const } },
              { caption: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const items = await this.prisma.mediaAsset.findMany({
      where,
      include: ASSET_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;
    return {
      items: page.map((asset) => this.toDto(asset)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async findOne(assetId: string, userId: string): Promise<MediaAssetDto> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null },
      include: ASSET_INCLUDE,
    });
    if (!asset) throw new NotFoundException("Media asset not found.");
    await this.workspaces.assertMembership(asset.workspaceId, userId, VIEW_ROLES);
    return this.toDto(asset);
  }

  /* -------------------------------- Mutations ------------------------------- */

  async update(assetId: string, input: UpdateMediaInput, userId: string): Promise<MediaAssetDto> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException("Media asset not found.");

    // Uploaders may edit their own assets; editing someone else's needs MANAGER+.
    const roles = asset.uploadedById === userId ? CONTENT_CREATE_ROLES : CONTENT_MANAGE_ROLES;
    await this.workspaces.assertMembership(asset.workspaceId, userId, roles);

    if (input.folderId) await this.assertFolderInWorkspace(input.folderId, asset.workspaceId);

    const updated = await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: {
        ...(input.fileName !== undefined ? { fileName: input.fileName } : {}),
        ...(input.altText !== undefined ? { altText: input.altText } : {}),
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
        ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
      },
      include: ASSET_INCLUDE,
    });
    return this.toDto(updated);
  }

  /**
   * Soft delete. Refused while any PUBLISHED PostTarget still references the asset, because that
   * target is the record of what was actually published.
   */
  async remove(assetId: string, userId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException("Media asset not found.");

    const roles = asset.uploadedById === userId ? CONTENT_CREATE_ROLES : DESTRUCTIVE_ROLES;
    await this.workspaces.assertMembership(asset.workspaceId, userId, roles);

    const publishedUse = await this.countPublishedUsage(assetId);
    if (publishedUse > 0) {
      throw new ConflictException(
        `This asset was published in ${publishedUse} post${publishedUse === 1 ? "" : "s"} and cannot be deleted.`,
      );
    }

    await this.prisma.mediaAsset.update({ where: { id: assetId }, data: { deletedAt: new Date() } });
  }

  async bulk(input: BulkMediaInput, userId: string): Promise<{ affected: number; skipped: number }> {
    await this.workspaces.assertMembership(input.workspaceId, userId, CONTENT_MANAGE_ROLES);

    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: input.assetIds }, workspaceId: input.workspaceId, deletedAt: null },
      select: { id: true },
    });
    const ids = assets.map((a) => a.id);
    if (ids.length === 0) return { affected: 0, skipped: input.assetIds.length };

    let affected = 0;
    let skipped = input.assetIds.length - ids.length;

    switch (input.action) {
      case "move": {
        if (input.folderId) await this.assertFolderInWorkspace(input.folderId, input.workspaceId);
        const result = await this.prisma.mediaAsset.updateMany({
          where: { id: { in: ids } },
          data: { folderId: input.folderId ?? null },
        });
        affected = result.count;
        break;
      }
      case "favorite":
      case "unfavorite": {
        const result = await this.prisma.mediaAsset.updateMany({
          where: { id: { in: ids } },
          data: { isFavorite: input.action === "favorite" },
        });
        affected = result.count;
        break;
      }
      case "delete": {
        // Skip anything still referenced by a published target rather than failing the whole
        // batch — selecting 200 assets shouldn't be blocked by one published image.
        const deletable: string[] = [];
        for (const id of ids) {
          if ((await this.countPublishedUsage(id)) === 0) deletable.push(id);
          else skipped++;
        }
        const result = await this.prisma.mediaAsset.updateMany({
          where: { id: { in: deletable } },
          data: { deletedAt: new Date() },
        });
        affected = result.count;
        break;
      }
      case "tag":
      case "untag": {
        const tagIds = input.tagIds ?? [];
        if (tagIds.length === 0) {
          throw new BadRequestException("Choose at least one tag.");
        }
        // Reject tags from another workspace rather than silently ignoring them.
        const valid = await this.prisma.tag.count({
          where: { id: { in: tagIds }, workspaceId: input.workspaceId },
        });
        if (valid !== tagIds.length) {
          throw new BadRequestException("One or more tags are not in this workspace.");
        }

        if (input.action === "tag") {
          const result = await this.prisma.mediaAssetTag.createMany({
            // Re-tagging an already-tagged asset is a no-op, not an error.
            data: ids.flatMap((mediaAssetId) => tagIds.map((tagId) => ({ mediaAssetId, tagId }))),
            skipDuplicates: true,
          });
          affected = result.count;
        } else {
          const result = await this.prisma.mediaAssetTag.deleteMany({
            where: { mediaAssetId: { in: ids }, tagId: { in: tagIds } },
          });
          affected = result.count;
        }
        break;
      }
    }

    return { affected, skipped };
  }

  /* -------------------------------- Folders -------------------------------- */

  async listFolders(workspaceId: string, userId: string): Promise<MediaFolderDto[]> {
    await this.workspaces.assertMembership(workspaceId, userId, VIEW_ROLES);

    const folders = await this.prisma.mediaFolder.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { path: "asc" },
      include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
    });

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      path: folder.path,
      assetCount: folder._count.assets,
    }));
  }

  async createFolder(input: CreateFolderInput, userId: string): Promise<MediaFolderDto> {
    await this.workspaces.assertMembership(input.workspaceId, userId, CONTENT_CREATE_ROLES);

    let parentPath = "";
    if (input.parentId) {
      const parent = await this.assertFolderInWorkspace(input.parentId, input.workspaceId);
      parentPath = parent.path === "/" ? "" : parent.path;
    }

    try {
      const folder = await this.prisma.mediaFolder.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          parentId: input.parentId ?? null,
          path: `${parentPath}/${input.name}`,
        },
      });
      return {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        path: folder.path,
        assetCount: 0,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A folder with that name already exists here.");
      }
      throw err;
    }
  }

  async updateFolder(
    folderId: string,
    input: UpdateFolderInput,
    userId: string,
  ): Promise<MediaFolderDto> {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id: folderId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException("Folder not found.");
    await this.workspaces.assertMembership(folder.workspaceId, userId, CONTENT_MANAGE_ROLES);

    let newParentPath = "";
    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === folderId) {
        throw new BadRequestException("A folder cannot be its own parent.");
      }
      const parent = await this.assertFolderInWorkspace(input.parentId, folder.workspaceId);
      // Reparenting under a descendant would detach the subtree from the root entirely.
      if (parent.path === folder.path || parent.path.startsWith(`${folder.path}/`)) {
        throw new BadRequestException("A folder cannot be moved inside one of its own subfolders.");
      }
      newParentPath = parent.path === "/" ? "" : parent.path;
    }

    const name = input.name ?? folder.name;
    const nextPath =
      input.parentId !== undefined
        ? `${newParentPath}/${name}`
        : replaceLastSegment(folder.path, name);

    // `path` is denormalized, so renaming or moving a folder has to rewrite every descendant's
    // path in the same transaction or the subtree becomes unreachable by prefix query.
    const [updated] = await this.prisma.$transaction([
      this.prisma.mediaFolder.update({
        where: { id: folderId },
        data: {
          name,
          ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
          path: nextPath,
        },
      }),
      this.prisma.$executeRaw`
        UPDATE "media_folders"
        SET "path" = ${nextPath} || substring("path" from ${folder.path.length + 1})
        WHERE "workspaceId" = ${folder.workspaceId}
          AND "path" LIKE ${`${folder.path}/%`}
      `,
    ]);

    return {
      id: updated.id,
      name: updated.name,
      parentId: updated.parentId,
      path: updated.path,
      assetCount: 0,
    };
  }

  async removeFolder(folderId: string, userId: string): Promise<void> {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id: folderId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException("Folder not found.");
    await this.workspaces.assertMembership(folder.workspaceId, userId, DESTRUCTIVE_ROLES);

    const assetCount = await this.prisma.mediaAsset.count({ where: { folderId, deletedAt: null } });
    if (assetCount > 0) {
      throw new ConflictException(
        `This folder still holds ${assetCount} asset${assetCount === 1 ? "" : "s"}. Move or delete them first.`,
      );
    }

    const childCount = await this.prisma.mediaFolder.count({
      where: { parentId: folderId, deletedAt: null },
    });
    if (childCount > 0) throw new ConflictException("This folder still has subfolders.");

    await this.prisma.mediaFolder.update({
      where: { id: folderId },
      data: { deletedAt: new Date() },
    });
  }

  /* -------------------------------- Internals ------------------------------- */

  /**
   * Resolves assets for the publish pipeline, preserving the caller's order because carousel
   * sequence is meaningful. Exported through the module so `posts` never queries media tables
   * directly.
   */
  async resolveForPublishing(assetIds: string[]): Promise<AssetWithVariants[]> {
    if (assetIds.length === 0) return [];
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: assetIds }, deletedAt: null },
      include: ASSET_INCLUDE,
    });
    const byId = new Map(assets.map((a) => [a.id, a]));
    return assetIds.flatMap((id) => {
      const asset = byId.get(id);
      return asset ? [asset] : [];
    });
  }

  /** How many workspace assets from `assetIds` exist — used by posts to validate attachments. */
  async countInWorkspace(assetIds: string[], workspaceId: string): Promise<number> {
    if (assetIds.length === 0) return 0;
    return this.prisma.mediaAsset.count({
      where: { id: { in: assetIds }, workspaceId, deletedAt: null },
    });
  }

  private async countPublishedUsage(assetId: string): Promise<number> {
    // Counts posts that actually went out with this asset attached, via either the post-level
    // media set or a per-target override.
    return this.prisma.post.count({
      where: {
        deletedAt: null,
        targets: { some: { status: "PUBLISHED" } },
        OR: [
          { media: { some: { mediaAssetId: assetId } } },
          { targets: { some: { media: { some: { mediaAssetId: assetId } } } } },
        ],
      },
    });
  }

  private async assertFolderInWorkspace(folderId: string, workspaceId: string) {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id: folderId, workspaceId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException("Folder not found in this workspace.");
    return folder;
  }

  /** Public so `posts` can shape attached assets without duplicating the mapping. */
  toDto(asset: AssetWithVariants): MediaAssetDto {
    return {
      id: asset.id,
      workspaceId: asset.workspaceId,
      folderId: asset.folderId,
      type: asset.type as MediaType,
      status: asset.status,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      durationMs: asset.durationMs,
      altText: asset.altText,
      caption: asset.caption,
      isFavorite: asset.isFavorite,
      processingError: asset.processingError,
      variants: (asset.variants ?? []).map((v) => ({
        label: v.label,
        url: v.url,
        width: v.width,
        height: v.height,
        sizeBytes: v.sizeBytes,
      })),
      tags: (asset.tags ?? []).map((t) => t.tag),
      uploadedById: asset.uploadedById,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }
}

/**
 * Generated app-side so the storage key can embed the id before the row exists — the presign
 * response has to name a key, and we want one stable key per asset.
 */
function createAssetId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const random = Array.from(
    { length: 16 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
  return `c${Date.now().toString(36)}${random}`.slice(0, 25);
}

function buildStorageKey(workspaceId: string, assetId: string, fileName: string): string {
  // Strip anything that could traverse or otherwise confuse the key namespace.
  const safe = fileName.replace(/[^\w.-]+/g, "_").slice(-100);
  return `workspaces/${workspaceId}/media/${assetId}/${safe}`;
}

function replaceLastSegment(path: string, name: string): string {
  return `${path.slice(0, path.lastIndexOf("/"))}/${name}`;
}
