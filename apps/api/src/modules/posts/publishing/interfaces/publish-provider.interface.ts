import type { MediaType, SocialPlatform } from "@prisma/client";

/** Platforms with a working publish implementation — distinct from SocialPlatform, exactly as
 *  ConnectablePlatform is on the OAuth side. */
export type PublishablePlatform = "FACEBOOK" | "INSTAGRAM" | "TIKTOK";

export const PUBLISHABLE_PLATFORMS: PublishablePlatform[] = ["FACEBOOK", "INSTAGRAM", "TIKTOK"];

export interface PublishMedia {
  assetId: string;
  type: MediaType;
  mimeType: string;
  /** Internet-reachable URL. Empty when MEDIA_PUBLIC_BASE_URL is unset — see requiresPublicMediaUrls. */
  publicUrl: string;
  storageKey: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sizeBytes: number;
  altText: string | null;
}

export interface PublishRequest {
  target: {
    id: string;
    idempotencyKey: string;
    containerId: string | null;
    attempts: number;
  };
  account: {
    platform: SocialPlatform;
    externalAccountId: string;
    /** Decrypted. Never log this, never put it in an error message. */
    accessToken: string;
    metadata: Record<string, unknown> | null;
  };
  content: string;
  firstComment: string | null;
  media: PublishMedia[];
  options: Record<string, unknown>;
  scheduledAt: Date | null;
}

export type PublishOutcome =
  | { kind: "PUBLISHED"; platformPostId: string; permalink?: string; publishedAt: Date }
  /**
   * The platform accepted the content but hasn't finished processing it (Instagram video
   * containers, TikTok transcodes). Lets the processor re-queue with a delay instead of blocking
   * a worker for minutes, and does NOT consume a retry attempt.
   */
  | { kind: "PENDING"; containerId: string; recheckAfterMs: number };

export class PublishError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code?: string,
    /** Flips the SocialAccount to an unhealthy state and stops further attempts. */
    readonly tokenInvalid = false,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

export interface PublishContext {
  /**
   * Persists the platform's container/publish id BEFORE the finalizing call. This is the single
   * most important defence against double-posting: if the finalize response is lost, the retry
   * resumes the existing container instead of creating a second one.
   */
  saveContainerId(containerId: string): Promise<void>;
}

export interface PublishProvider {
  readonly platform: SocialPlatform;
  /**
   * True when the platform fetches media from a URL we supply (Facebook, Instagram) rather than
   * accepting an upload (TikTok FILE_UPLOAD). Providers that need public URLs cannot run against
   * a localhost MinIO, which is why the stub publisher exists.
   */
  readonly requiresPublicMediaUrls: boolean;

  /** Platform rules beyond the shared PLATFORM_LIMITS checks. Runs before anything is enqueued. */
  validate(request: PublishRequest): { ok: boolean; errors: string[] };

  publish(request: PublishRequest, ctx: PublishContext): Promise<PublishOutcome>;

  /** Polls an async publish started by a previous PENDING outcome. */
  checkStatus?(request: PublishRequest, containerId: string): Promise<PublishOutcome>;
}
