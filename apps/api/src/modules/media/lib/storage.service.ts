import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StoredObjectHead {
  sizeBytes: number;
  mimeType: string | null;
  etag: string | null;
}

/**
 * The only place the app talks to object storage. First consumer of the `storage` config block,
 * which has been populated (and Zod-required) since Phase 1 without anything reading it.
 *
 * Uploads are always presigned and go browser -> storage directly, never through Nest. That's
 * partly for throughput, but mainly because `main.ts` creates the app with `bodyParser: false`
 * (Better Auth needs the raw body), so multipart handling would need bespoke middleware.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  /** Host that presigned URLs are handed to the browser on. See `toSigningOrigin`. */
  private readonly signingOrigin: string;
  /** Bucket-rooted host that unsigned public reads are served from. See `publicUrl`. */
  private readonly publicReadOrigin: string;
  private readonly signedUrlTtl: number;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>("storage.endpoint")!;
    this.bucket = this.config.get<string>("storage.bucket")!;
    this.signingOrigin = (this.config.get<string>("storage.signingOrigin") ?? endpoint).replace(
      /\/$/,
      "",
    );
    this.publicReadOrigin = (this.config.get<string>("storage.publicReadOrigin") ?? "").replace(
      /\/$/,
      "",
    );
    this.signedUrlTtl = this.config.get<number>("media.signedUrlTtlSeconds") ?? 3600;

    this.client = new S3Client({
      endpoint,
      region: this.config.get<string>("storage.region") ?? "us-east-1",
      forcePathStyle: this.config.get<boolean>("storage.forcePathStyle")!,
      credentials: {
        accessKeyId: this.config.get<string>("storage.accessKeyId")!,
        secretAccessKey: this.config.get<string>("storage.secretAccessKey")!,
      },
    });
  }

  /**
   * A presigned PUT the browser uploads to. `contentType` is part of the signature, so the client
   * MUST send exactly the same Content-Type header or storage rejects it — that pairing is why
   * `uploadToPresignedUrl` on the web side takes the type explicitly rather than letting the
   * browser infer it from the File.
   */
  async presignPut(key: string, contentType: string, ttlSeconds?: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: ttlSeconds ?? this.signedUrlTtl,
    });
    return this.toSigningOrigin(url);
  }

  async presignGet(key: string, ttlSeconds?: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: ttlSeconds ?? this.signedUrlTtl,
    });
    return this.toSigningOrigin(url);
  }

  /** Verifies an object actually landed, and how big it really is — never trust the client's claim. */
  async head(key: string): Promise<StoredObjectHead | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        sizeBytes: result.ContentLength ?? 0,
        mimeType: result.ContentType ?? null,
        etag: result.ETag ?? null,
      };
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NotFound" || name === "NoSuchKey") return null;
      throw err;
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    // The SDK's Body is a Node Readable in this runtime; iterate rather than buffering via a helper
    // so we don't depend on the smithy stream-collector's shape.
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    // S3 caps DeleteObjects at 1000 keys per call.
    for (let i = 0; i < keys.length; i += 1000) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
        }),
      );
    }
  }

  /**
   * Unsigned URL, only resolvable if the bucket allows public reads.
   *
   * Two shapes, because the two supported backends root their public URLs differently:
   * an R2 custom domain (or r2.dev subdomain) is already bucket-scoped, so the key hangs straight
   * off the origin; MinIO serves every bucket from one origin and needs the path-style prefix.
   *
   * The result is **persisted** to MediaAsset.url and MediaVariant.url, so changing storage
   * backends after go-live means backfilling those columns — the shape is not recomputed on read.
   */
  publicUrl(key: string): string {
    if (this.publicReadOrigin) return `${this.publicReadOrigin}/${encodeURI(key)}`;
    return `${this.signingOrigin}/${this.bucket}/${encodeURI(key)}`;
  }

  /**
   * Presigned URLs are signed against whatever host the SDK was configured with. When the API runs
   * in Docker that host is `minio:9000`, which the browser cannot resolve — so swap the origin for
   * the browser-facing one.
   *
   * This rewrite is **MinIO-only**. It is safe there because MinIO does not verify the Host header
   * on presigned URLs, but `host` *is* part of X-Amz-SignedHeaders under real SigV4: on Cloudflare
   * R2 or AWS S3 the same swap produces SignatureDoesNotMatch. On those backends leave
   * S3_PUBLIC_URL unset so `signingOrigin === endpoint` and the early return fires — a public
   * media domain belongs in S3_PUBLIC_READ_URL, which is never signed. `configuration.ts` rejects
   * the unsafe combination at boot.
   */
  private toSigningOrigin(signedUrl: string): string {
    const endpoint = this.config.get<string>("storage.endpoint")!.replace(/\/$/, "");
    if (endpoint === this.signingOrigin) return signedUrl;
    return signedUrl.replace(endpoint, this.signingOrigin);
  }
}
