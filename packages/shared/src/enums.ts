/**
 * Const-object enums mirroring `apps/api/prisma/schema.prisma`. They are duplicated here by hand
 * rather than imported from `@prisma/client` because apps/web must never depend on Prisma — but
 * that means **any enum change has to land in both files in the same commit**.
 */

export const SocialPlatform = {
  FACEBOOK: "FACEBOOK",
  INSTAGRAM: "INSTAGRAM",
  TIKTOK: "TIKTOK",
  LINKEDIN: "LINKEDIN",
  TWITTER: "TWITTER",
  THREADS: "THREADS",
  PINTEREST: "PINTEREST",
  YOUTUBE: "YOUTUBE",
} as const;
export type SocialPlatform = (typeof SocialPlatform)[keyof typeof SocialPlatform];

export const SOCIAL_PLATFORMS = Object.values(SocialPlatform);

/** The subset that has a working publish implementation. Distinct from SocialPlatform, exactly as
 *  ConnectablePlatform is distinct from it on the OAuth side. */
export const PUBLISHABLE_PLATFORMS = [
  SocialPlatform.FACEBOOK,
  SocialPlatform.INSTAGRAM,
  SocialPlatform.TIKTOK,
] as const;
export type PublishablePlatform = (typeof PUBLISHABLE_PLATFORMS)[number];

export const SocialAccountStatus = {
  CONNECTED: "CONNECTED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  REVOKED: "REVOKED",
  ERROR: "ERROR",
} as const;
export type SocialAccountStatus = (typeof SocialAccountStatus)[keyof typeof SocialAccountStatus];

export const WorkspaceRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const PostStatus = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  SCHEDULED: "SCHEDULED",
  PUBLISHING: "PUBLISHING",
  PUBLISHED: "PUBLISHED",
  PARTIALLY_PUBLISHED: "PARTIALLY_PUBLISHED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

export const PostTargetStatus = {
  PENDING: "PENDING",
  QUEUED: "QUEUED",
  PUBLISHING: "PUBLISHING",
  PUBLISHED: "PUBLISHED",
  RETRYING: "RETRYING",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  /** Validation failed for this platform only — the post still publishes elsewhere. */
  SKIPPED: "SKIPPED",
} as const;
export type PostTargetStatus = (typeof PostTargetStatus)[keyof typeof PostTargetStatus];

/** Target states from which no further transition happens without explicit user action. */
export const TERMINAL_TARGET_STATUSES: PostTargetStatus[] = [
  PostTargetStatus.PUBLISHED,
  PostTargetStatus.FAILED,
  PostTargetStatus.CANCELLED,
  PostTargetStatus.SKIPPED,
];

export const ApprovalStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const MediaType = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  DOCUMENT: "DOCUMENT",
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

/** Presigned upload creates the row before the bytes exist, so an asset has a lifecycle. */
export const MediaStatus = {
  UPLOADING: "UPLOADING",
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
} as const;
export type MediaStatus = (typeof MediaStatus)[keyof typeof MediaStatus];

export const CampaignStatus = {
  PLANNING: "PLANNING",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const SnippetKind = {
  TEXT: "TEXT",
  HASHTAG_GROUP: "HASHTAG_GROUP",
  CTA: "CTA",
  SIGNATURE: "SIGNATURE",
} as const;
export type SnippetKind = (typeof SnippetKind)[keyof typeof SnippetKind];

export const NotificationType = {
  PUBLISH_SUCCESS: "PUBLISH_SUCCESS",
  PUBLISH_FAILED: "PUBLISH_FAILED",
  SCHEDULE_REMINDER: "SCHEDULE_REMINDER",
  TOKEN_EXPIRING: "TOKEN_EXPIRING",
  WORKSPACE_INVITE: "WORKSPACE_INVITE",
  APPROVAL_REQUEST: "APPROVAL_REQUEST",
  NEW_TEAM_MEMBER: "NEW_TEAM_MEMBER",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
