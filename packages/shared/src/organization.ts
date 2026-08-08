import { z } from "zod";
import { CampaignStatus, SnippetKind, SocialPlatform } from "./enums";
import type { WorkspaceRole } from "./enums";

/* ----------------------------------- Tags ---------------------------------- */

export const createTagSchema = z
  .object({
    workspaceId: z.string().cuid(),
    name: z.string().min(1).max(60),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #4F46E5")
      .nullish(),
  })
  .strict();
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullish(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export interface TagDto {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  postCount: number;
  assetCount: number;
}

/** Derives the stable identifier from a display name. Shared so client previews match the server. */
export function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* --------------------------------- Campaigns -------------------------------- */

export const createCampaignSchema = z
  .object({
    workspaceId: z.string().cuid(),
    name: z.string().min(1).max(120),
    description: z.string().max(2000).nullish(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullish(),
    goal: z.string().max(500).nullish(),
    status: z.nativeEnum(CampaignStatus).default(CampaignStatus.PLANNING),
    startsAt: z.string().datetime().nullish(),
    endsAt: z.string().datetime().nullish(),
  })
  .strict()
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.startsAt) <= new Date(v.endsAt), {
    message: "A campaign cannot end before it starts.",
    path: ["endsAt"],
  });
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).nullish(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullish(),
    goal: z.string().max(500).nullish(),
    status: z.nativeEnum(CampaignStatus).optional(),
    startsAt: z.string().datetime().nullish(),
    endsAt: z.string().datetime().nullish(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export interface CampaignDto {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  goal: string | null;
  status: CampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  postCount: number;
  publishedCount: number;
  createdAt: string;
}

/* --------------------------------- Templates -------------------------------- */

/** `{{variable}}` placeholders, extracted on save so the UI can prompt for each one. */
export function extractTemplateVariables(content: string): string[] {
  const matches = content.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  return Array.from(new Set(Array.from(matches, (m) => m[1]!).filter(Boolean)));
}

export function applyTemplateVariables(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name: string) =>
    // An unsupplied variable stays visible as {{name}} rather than becoming an empty gap, so a
    // half-filled template is obvious in the composer instead of publishing with a hole in it.
    Object.prototype.hasOwnProperty.call(values, name) ? values[name]! : match,
  );
}

export const createTemplateSchema = z
  .object({
    workspaceId: z.string().cuid(),
    name: z.string().min(1).max(120),
    description: z.string().max(1000).nullish(),
    category: z.string().max(60).nullish(),
    content: z.string().min(1).max(63_206),
    contentJson: z.unknown().nullish(),
    defaultPlatforms: z.array(z.nativeEnum(SocialPlatform)).default([]),
  })
  .strict();
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(1000).nullish(),
    category: z.string().max(60).nullish(),
    content: z.string().min(1).max(63_206).optional(),
    contentJson: z.unknown().nullish(),
    defaultPlatforms: z.array(z.nativeEnum(SocialPlatform)).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const instantiateTemplateSchema = z
  .object({
    variables: z.record(z.string()).default({}),
    socialAccountIds: z.array(z.string().cuid()).default([]),
  })
  .strict();
export type InstantiateTemplateInput = z.infer<typeof instantiateTemplateSchema>;

export interface TemplateDto {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  content: string;
  contentJson: unknown | null;
  variables: string[];
  defaultPlatforms: SocialPlatform[];
  usageCount: number;
  createdAt: string;
}

/* --------------------------------- Snippets --------------------------------- */

export const createSnippetSchema = z
  .object({
    workspaceId: z.string().cuid(),
    name: z.string().min(1).max(120),
    kind: z.nativeEnum(SnippetKind).default(SnippetKind.TEXT),
    body: z.string().min(1).max(5000),
  })
  .strict();
export type CreateSnippetInput = z.infer<typeof createSnippetSchema>;

export const updateSnippetSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    kind: z.nativeEnum(SnippetKind).optional(),
    body: z.string().min(1).max(5000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });
export type UpdateSnippetInput = z.infer<typeof updateSnippetSchema>;

export interface SnippetDto {
  id: string;
  name: string;
  kind: SnippetKind;
  body: string;
  createdAt: string;
}

/* -------------------------- Tag assignment on content ----------------------- */

export const setTagsSchema = z
  .object({
    tagIds: z.array(z.string().cuid()).max(50),
  })
  .strict();
export type SetTagsInput = z.infer<typeof setTagsSchema>;

/* -------------------------------- Workspaces -------------------------------- */

export const createWorkspaceSchema = z
  .object({
    name: z.string().min(1).max(120),
    slug: z
      .string()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only")
      .optional(),
  })
  .strict();
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    logoUrl: z.string().url().nullish(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const inviteMemberSchema = z
  .object({
    email: z.string().email(),
    role: z.enum(["ADMIN", "MANAGER", "EDITOR", "VIEWER"]),
  })
  .strict();
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z
  .object({ role: z.enum(["ADMIN", "MANAGER", "EDITOR", "VIEWER"]) })
  .strict();
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export interface WorkspaceMemberDto {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  isOwner: boolean;
  joinedAt: string;
}

export interface WorkspaceInvitationDto {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
}

/* ------------------------------------ AI ------------------------------------ */

export const suggestCaptionsSchema = z
  .object({
    workspaceId: z.string().cuid(),
    prompt: z.string().min(3).max(2000),
    platforms: z.array(z.nativeEnum(SocialPlatform)).default([]),
    tone: z.string().max(60).optional(),
    count: z.number().int().min(1).max(5).default(3),
  })
  .strict();
export type SuggestCaptionsInput = z.infer<typeof suggestCaptionsSchema>;

export interface CaptionSuggestionDto {
  content: string;
  hashtags: string[];
  characterCount: number;
  withinLimit: boolean;
}
