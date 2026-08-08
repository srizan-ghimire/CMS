import { z } from "zod";
import type { PostTargetStatus, SocialAccountStatus, SocialPlatform } from "./enums";
import { PostStatus } from "./enums";
import type { MediaAssetDto } from "./media";

/** Shape returned by GET /social-accounts/workspaces/:id — the composer's account picker. */
export interface SocialAccountSummary {
  id: string;
  platform: SocialPlatform;
  externalAccountId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  status: SocialAccountStatus;
  tokenExpiresAt: string | null;
  scopes: string[];
  connectedById: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A post is composed once and delivered to N targets. Each target may override the content, the
 * media, or platform-specific options — overriding nothing (the common case) inherits the post.
 */
export const postTargetInputSchema = z.object({
  socialAccountId: z.string().cuid(),
  /** null/undefined inherits `Post.content`. */
  contentOverride: z.string().max(63_206).nullish(),
  contentJsonOverride: z.unknown().nullish(),
  firstCommentOverride: z.string().max(2_200).nullish(),
  /** Empty inherits the post's media; a non-empty list replaces it for this target only. */
  mediaAssetIds: z.array(z.string().cuid()).max(35).optional(),
  platformOptions: z.record(z.unknown()).optional(),
}).strict();
export type PostTargetInput = z.infer<typeof postTargetInputSchema>;

export const createPostSchema = z.object({
  workspaceId: z.string().cuid(),
  title: z.string().max(200).nullish(),
  // Facebook's ceiling is the widest of any platform; per-platform limits are enforced against
  // PLATFORM_LIMITS once the targets are known, so this is only a sanity bound.
  content: z.string().max(63_206).default(""),
  contentJson: z.unknown().nullish(),
  firstComment: z.string().max(2_200).nullish(),
  /** Ordered — carousel sequence is meaningful. */
  mediaAssetIds: z.array(z.string().cuid()).max(35).default([]),
  targets: z.array(postTargetInputSchema).max(50).default([]),
  scheduledAt: z.string().datetime().nullish(),
  timezone: z.string().default("UTC"),
  campaignId: z.string().cuid().nullish(),
  /** RFC-5545 RRULE, e.g. "FREQ=WEEKLY;BYDAY=MO". Occurrences are materialized as separate
   *  posts by the scheduling sweep — this post becomes the recurrence parent. */
  recurrenceRule: z.string().max(500).nullish(),
  recurrenceEndsAt: z.string().datetime().nullish(),
  recurrenceCount: z.number().int().min(1).max(365).nullish(),
}).strict();
export type CreatePostInput = z.infer<typeof createPostSchema>;

/**
 * Every field optional so the composer can autosave a single changed field. `targets` and
 * `mediaAssetIds` are full replacements when present — the server diffs them against what exists
 * rather than the client sending patch operations.
 */
export const updatePostSchema = z
  .object({
    title: z.string().max(200).nullish(),
    content: z.string().max(63_206).optional(),
    contentJson: z.unknown().nullish(),
    firstComment: z.string().max(2_200).nullish(),
    mediaAssetIds: z.array(z.string().cuid()).max(35).optional(),
    targets: z.array(postTargetInputSchema).max(50).optional(),
    scheduledAt: z.string().datetime().nullish(),
    timezone: z.string().optional(),
    campaignId: z.string().cuid().nullish(),
    recurrenceRule: z.string().max(500).nullish(),
    recurrenceEndsAt: z.string().datetime().nullish(),
    recurrenceCount: z.number().int().min(1).max(365).nullish(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update." });
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const listPostsQuerySchema = z.object({
  workspaceId: z.string().cuid(),
  status: z
    .string()
    .optional()
    .transform((value) => (value ? (value.split(",").filter(Boolean) as PostStatus[]) : undefined)),
  authorId: z.string().cuid().optional(),
  socialAccountId: z.string().cuid().optional(),
  search: z.string().max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  /** Archived posts are excluded by default — they're intentionally out of the working set. */
  includeArchived: z.coerce.boolean().default(false),
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export interface PostTargetDto {
  id: string;
  socialAccountId: string;
  platform: SocialPlatform;
  accountName: string;
  accountHandle: string | null;
  accountAvatarUrl: string | null;
  status: PostTargetStatus;
  contentOverride: string | null;
  firstCommentOverride: string | null;
  platformOptions: Record<string, unknown> | null;
  mediaAssetIds: string[];
  platformPostId: string | null;
  permalink: string | null;
  errorMessage: string | null;
  attempts: number;
  publishedAt: string | null;
}

export interface PostDto {
  id: string;
  workspaceId: string;
  authorId: string;
  title: string | null;
  content: string;
  contentJson: unknown | null;
  firstComment: string | null;
  status: PostStatus;
  timezone: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  currentVersion: number;
  campaignId: string | null;
  tags: { id: string; name: string; color: string | null }[];
  recurrenceRule: string | null;
  media: MediaAssetDto[];
  targets: PostTargetDto[];
  createdAt: string;
  updatedAt: string;
}

/** Per-target validation result, surfaced in the composer rather than from a queue failure. */
export interface TargetValidation {
  socialAccountId: string;
  platform: SocialPlatform;
  ok: boolean;
  errors: string[];
}

/** Statuses where the content is locked because publishing is under way or finished. */
export const LOCKED_POST_STATUSES: PostStatus[] = [
  PostStatus.PUBLISHING,
  PostStatus.PUBLISHED,
  PostStatus.PARTIALLY_PUBLISHED,
];

export function isPostEditable(status: PostStatus): boolean {
  return !LOCKED_POST_STATUSES.includes(status);
}
