import { z } from "zod";
import type { ApprovalStatus, WorkspaceRole } from "./enums";

/* -------------------------------- Versions -------------------------------- */

export interface PostVersionDto {
  id: string;
  versionNumber: number;
  title: string | null;
  content: string;
  changeSummary: string | null;
  editedById: string | null;
  editedByName: string | null;
  createdAt: string;
}

export const restoreVersionSchema = z
  .object({ versionNumber: z.number().int().positive() })
  .strict();
export type RestoreVersionInput = z.infer<typeof restoreVersionSchema>;

/* -------------------------------- Approvals ------------------------------- */

export const requestApprovalSchema = z
  .object({
    /** Empty means "everyone eligible under the workspace policy". */
    reviewerIds: z.array(z.string().cuid()).max(20).default([]),
    note: z.string().max(1000).nullish(),
  })
  .strict();
export type RequestApprovalInput = z.infer<typeof requestApprovalSchema>;

export const decideApprovalSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: z.string().max(1000).nullish(),
  })
  .strict();
export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>;

export interface PostApprovalDto {
  id: string;
  postId: string;
  reviewerId: string;
  reviewerName: string;
  round: number;
  status: ApprovalStatus;
  note: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export const updateApprovalPolicySchema = z
  .object({
    enabled: z.boolean().optional(),
    requiredApprovals: z.number().int().min(1).max(10).optional(),
    approverRoles: z.array(z.enum(["OWNER", "ADMIN", "MANAGER", "EDITOR", "VIEWER"])).optional(),
    allowAuthorSelfApprove: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });
export type UpdateApprovalPolicyInput = z.infer<typeof updateApprovalPolicySchema>;

export interface ApprovalPolicyDto {
  enabled: boolean;
  requiredApprovals: number;
  approverRoles: WorkspaceRole[];
  allowAuthorSelfApprove: boolean;
}

/* --------------------------------- Comments -------------------------------- */

export const createCommentSchema = z
  .object({
    body: z.string().min(1).max(5000),
    parentId: z.string().cuid().nullish(),
    mentionedUserIds: z.array(z.string().cuid()).max(20).default([]),
  })
  .strict();
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export interface CommentDto {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  mentionedUserIds: string[];
  resolvedAt: string | null;
  createdAt: string;
  replies: CommentDto[];
}
