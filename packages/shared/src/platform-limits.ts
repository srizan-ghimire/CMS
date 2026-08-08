import { MediaType, SocialPlatform } from "./enums";

/**
 * The single definition of what each platform accepts. Consumed by the composer's character
 * counters and media validation in apps/web, AND by every `PublishProvider.validate()` in the API —
 * so a post that looks valid in the editor cannot fail validation in the publish queue.
 *
 * Numbers are the documented API limits, not the UI limits the platforms show their own users
 * (those are often lower). Where a platform's limit depends on account type or product surface
 * (Reels vs Feed vs Stories), this holds the most permissive value and the provider narrows it.
 */
export interface PlatformLimits {
  maxChars: number;
  maxImages: number;
  maxVideos: number;
  maxVideoBytes: number;
  maxImageBytes: number;
  minVideoDurationSec: number;
  maxVideoDurationSec: number;
  /** Whether images and videos may appear in the same post. */
  allowsMixedMedia: boolean;
  /** Whether a post with no media at all is valid. Instagram and TikTok say no. */
  allowsTextOnly: boolean;
  /** Whether the platform supports posting a first comment alongside the post. */
  supportsFirstComment: boolean;
  /** Accepted width/height ratio range for images, or null when unconstrained. */
  imageAspectRatio: { min: number; max: number } | null;
  acceptedMediaTypes: MediaType[];
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLATFORM_LIMITS: Record<SocialPlatform, PlatformLimits> = {
  [SocialPlatform.FACEBOOK]: {
    maxChars: 63_206,
    maxImages: 10,
    maxVideos: 1,
    maxVideoBytes: 10 * GB,
    maxImageBytes: 30 * MB,
    minVideoDurationSec: 1,
    maxVideoDurationSec: 14_400, // 240 minutes
    allowsMixedMedia: false,
    allowsTextOnly: true,
    supportsFirstComment: true,
    imageAspectRatio: null,
    acceptedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
  },
  [SocialPlatform.INSTAGRAM]: {
    maxChars: 2_200,
    maxImages: 10, // carousel maximum; minimum 2 for a carousel, 1 for a single post
    maxVideos: 1,
    maxVideoBytes: 1 * GB,
    maxImageBytes: 8 * MB,
    minVideoDurationSec: 3,
    maxVideoDurationSec: 900, // 15 minutes for Reels
    allowsMixedMedia: true, // carousels may mix images and video
    allowsTextOnly: false, // media is mandatory — the single most common publish failure
    supportsFirstComment: true,
    imageAspectRatio: { min: 0.8, max: 1.91 }, // 4:5 through 1.91:1
    acceptedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
  },
  [SocialPlatform.TIKTOK]: {
    maxChars: 2_200,
    maxImages: 35, // photo posts
    maxVideos: 1,
    maxVideoBytes: 4 * GB,
    maxImageBytes: 20 * MB,
    minVideoDurationSec: 3,
    maxVideoDurationSec: 600, // 10 minutes
    allowsMixedMedia: false,
    allowsTextOnly: false,
    supportsFirstComment: false,
    imageAspectRatio: null,
    acceptedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
  },
  [SocialPlatform.LINKEDIN]: {
    maxChars: 3_000,
    maxImages: 9,
    maxVideos: 1,
    maxVideoBytes: 5 * GB,
    maxImageBytes: 10 * MB,
    minVideoDurationSec: 3,
    maxVideoDurationSec: 600,
    allowsMixedMedia: false,
    allowsTextOnly: true,
    supportsFirstComment: true,
    imageAspectRatio: null,
    acceptedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO, MediaType.DOCUMENT],
  },
  [SocialPlatform.TWITTER]: {
    maxChars: 280,
    maxImages: 4,
    maxVideos: 1,
    maxVideoBytes: 512 * MB,
    maxImageBytes: 5 * MB,
    minVideoDurationSec: 1,
    maxVideoDurationSec: 140,
    allowsMixedMedia: false,
    allowsTextOnly: true,
    supportsFirstComment: true,
    imageAspectRatio: null,
    acceptedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
  },
  [SocialPlatform.THREADS]: {
    maxChars: 500,
    maxImages: 20,
    maxVideos: 1,
    maxVideoBytes: 1 * GB,
    maxImageBytes: 8 * MB,
    minVideoDurationSec: 1,
    maxVideoDurationSec: 300,
    allowsMixedMedia: true,
    allowsTextOnly: true,
    supportsFirstComment: true,
    imageAspectRatio: null,
    acceptedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
  },
  [SocialPlatform.PINTEREST]: {
    maxChars: 500,
    maxImages: 1,
    maxVideos: 1,
    maxVideoBytes: 2 * GB,
    maxImageBytes: 20 * MB,
    minVideoDurationSec: 4,
    maxVideoDurationSec: 900,
    allowsMixedMedia: false,
    allowsTextOnly: false,
    supportsFirstComment: false,
    imageAspectRatio: null,
    acceptedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
  },
  [SocialPlatform.YOUTUBE]: {
    maxChars: 5_000, // description
    maxImages: 0,
    maxVideos: 1,
    maxVideoBytes: 128 * GB,
    maxImageBytes: 2 * MB, // thumbnail
    minVideoDurationSec: 1,
    maxVideoDurationSec: 43_200, // 12 hours
    allowsMixedMedia: false,
    allowsTextOnly: false,
    supportsFirstComment: true,
    imageAspectRatio: null,
    acceptedMediaTypes: [MediaType.VIDEO],
  },
};

/** The smallest character allowance across a set of platforms — what the composer counts against. */
export function strictestCharLimit(platforms: SocialPlatform[]): number {
  if (platforms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...platforms.map((p) => PLATFORM_LIMITS[p].maxChars));
}

export interface MediaSummary {
  type: MediaType;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

/**
 * Shared content validation. `PublishProvider.validate()` calls this and then adds its own
 * platform-specific rules on top (carousel minimums, creator settings, and so on).
 */
export function validateAgainstPlatform(
  platform: SocialPlatform,
  content: string,
  media: MediaSummary[],
): string[] {
  const limits = PLATFORM_LIMITS[platform];
  const errors: string[] = [];
  const label = platform.charAt(0) + platform.slice(1).toLowerCase();

  if (content.length > limits.maxChars) {
    errors.push(`${label}: caption is ${content.length} characters, limit is ${limits.maxChars}.`);
  }

  const images = media.filter((m) => m.type === MediaType.IMAGE);
  const videos = media.filter((m) => m.type === MediaType.VIDEO);

  if (media.length === 0 && !limits.allowsTextOnly) {
    errors.push(`${label}: requires at least one image or video.`);
  }
  if (content.trim().length === 0 && media.length === 0) {
    errors.push(`${label}: post is empty.`);
  }
  if (images.length > limits.maxImages) {
    errors.push(`${label}: ${images.length} images exceeds the limit of ${limits.maxImages}.`);
  }
  if (videos.length > limits.maxVideos) {
    errors.push(`${label}: ${videos.length} videos exceeds the limit of ${limits.maxVideos}.`);
  }
  if (images.length > 0 && videos.length > 0 && !limits.allowsMixedMedia) {
    errors.push(`${label}: images and video cannot be combined in one post.`);
  }

  for (const item of media) {
    if (!limits.acceptedMediaTypes.includes(item.type)) {
      errors.push(`${label}: does not accept ${item.type.toLowerCase()} attachments.`);
      continue;
    }

    if (item.type === MediaType.IMAGE) {
      if (item.sizeBytes > limits.maxImageBytes) {
        errors.push(`${label}: image exceeds ${Math.round(limits.maxImageBytes / MB)}MB.`);
      }
      if (limits.imageAspectRatio && item.width && item.height) {
        const ratio = item.width / item.height;
        const { min, max } = limits.imageAspectRatio;
        if (ratio < min || ratio > max) {
          errors.push(
            `${label}: image aspect ratio ${ratio.toFixed(2)} is outside the accepted ${min}–${max} range.`,
          );
        }
      }
    }

    if (item.type === MediaType.VIDEO) {
      if (item.sizeBytes > limits.maxVideoBytes) {
        errors.push(`${label}: video exceeds ${Math.round(limits.maxVideoBytes / GB)}GB.`);
      }
      if (item.durationMs != null) {
        const seconds = item.durationMs / 1000;
        if (seconds < limits.minVideoDurationSec) {
          errors.push(`${label}: video must be at least ${limits.minVideoDurationSec}s.`);
        }
        if (seconds > limits.maxVideoDurationSec) {
          errors.push(`${label}: video must be under ${limits.maxVideoDurationSec}s.`);
        }
      }
    }
  }

  return errors;
}
