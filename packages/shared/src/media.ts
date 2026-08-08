import { z } from "zod";
import { MediaStatus, MediaType } from "./enums";

/** MIME types we accept for upload, and the MediaType each maps to. */
export const ACCEPTED_MIME_TYPES: Record<string, MediaType> = {
  "image/jpeg": MediaType.IMAGE,
  "image/png": MediaType.IMAGE,
  "image/gif": MediaType.IMAGE,
  "image/webp": MediaType.IMAGE,
  "image/avif": MediaType.IMAGE,
  "video/mp4": MediaType.VIDEO,
  "video/quicktime": MediaType.VIDEO,
  "video/webm": MediaType.VIDEO,
  "application/pdf": MediaType.DOCUMENT,
};

export function mediaTypeForMime(mimeType: string): MediaType | null {
  return ACCEPTED_MIME_TYPES[mimeType.toLowerCase()] ?? null;
}

const mimeTypeSchema = z
  .string()
  .refine((value) => mediaTypeForMime(value) !== null, {
    message: "Unsupported file type.",
  });

/**
 * Step 1 of the 3-hop upload. The server creates an UPLOADING row and returns a presigned PUT;
 * the browser then uploads straight to storage, and calls finalize afterwards.
 */
export const presignUploadSchema = z.object({
  workspaceId: z.string().cuid(),
  fileName: z.string().min(1).max(255),
  mimeType: mimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  folderId: z.string().cuid().nullish(),
  /** sha256 hex, computed client-side, so an identical re-upload can reuse the existing asset. */
  checksum: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).strict();
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

/**
 * Step 3. Dimensions come from the client because the server deliberately does not decode video
 * (an ffmpeg layer would roughly double the API image); they're advisory and re-derived from the
 * real bytes for images during processing.
 */
export const finalizeUploadSchema = z.object({
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  durationMs: z.number().int().positive().nullish(),
  /** Storage key of a poster frame the browser captured for a video, uploaded via its own presign. */
  posterStorageKey: z.string().min(1).nullish(),
}).strict();
export type FinalizeUploadInput = z.infer<typeof finalizeUploadSchema>;

export const updateMediaSchema = z
  .object({
    fileName: z.string().min(1).max(255).optional(),
    altText: z.string().max(1000).nullish(),
    caption: z.string().max(2000).nullish(),
    folderId: z.string().cuid().nullish(),
    isFavorite: z.boolean().optional(),
    tagIds: z.array(z.string().cuid()).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update." });
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

export const listMediaQuerySchema = z.object({
  workspaceId: z.string().cuid(),
  folderId: z.string().cuid().optional(),
  /** "root" restricts to assets with no folder; omitted means every folder. */
  scope: z.enum(["all", "root", "folder"]).default("all"),
  type: z.nativeEnum(MediaType).optional(),
  status: z.nativeEnum(MediaStatus).optional(),
  search: z.string().max(200).optional(),
  isFavorite: z.coerce.boolean().optional(),
  tagIds: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",").filter(Boolean) : undefined)),
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;

export const createFolderSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z.string().min(1).max(120),
  parentId: z.string().cuid().nullish(),
}).strict();
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  parentId: z.string().cuid().nullish(),
}).strict();
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;

export const bulkMediaSchema = z.object({
  workspaceId: z.string().cuid(),
  assetIds: z.array(z.string().cuid()).min(1).max(500),
  action: z.enum(["move", "delete", "favorite", "unfavorite", "tag", "untag"]),
  folderId: z.string().cuid().nullish(),
  tagIds: z.array(z.string().cuid()).optional(),
}).strict();
export type BulkMediaInput = z.infer<typeof bulkMediaSchema>;

export interface MediaVariantDto {
  label: string;
  url: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
}

export interface MediaAssetDto {
  id: string;
  workspaceId: string;
  folderId: string | null;
  type: MediaType;
  status: MediaStatus;
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  altText: string | null;
  caption: string | null;
  isFavorite: boolean;
  processingError: string | null;
  variants: MediaVariantDto[];
  tags: { id: string; name: string; color: string | null }[];
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaFolderDto {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  assetCount: number;
}

export interface PresignUploadResponse {
  assetId: string;
  storageKey: string;
  uploadUrl: string;
  /** Headers the PUT must send verbatim — the signature covers Content-Type. */
  requiredHeaders: Record<string, string>;
  /** Set when the checksum matched an existing asset; skip the upload entirely. */
  duplicateOf: MediaAssetDto | null;
}
