import { WorkspaceRole } from "@prisma/client";

/**
 * Capability → allowed roles. Every workspace-scoped service passes one of these to
 * `WorkspacesService.assertMembership`, so permission rules live in one file instead of being
 * re-derived (and drifting) per module.
 *
 * Uses Prisma's `WorkspaceRole` rather than the mirrored one in `@social-platform/shared` because
 * these values are compared against `WorkspaceMember.role` straight out of the database.
 */

/** Descending privilege. Index 0 is the most privileged. */
export const ROLE_RANK: readonly WorkspaceRole[] = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MANAGER,
  WorkspaceRole.EDITOR,
  WorkspaceRole.VIEWER,
];

/** Every role at or above `minimum`, e.g. `atLeast(EDITOR)` → [OWNER, ADMIN, MANAGER, EDITOR]. */
export function atLeast(minimum: WorkspaceRole): WorkspaceRole[] {
  return ROLE_RANK.slice(0, ROLE_RANK.indexOf(minimum) + 1);
}

/** Read posts, media, campaigns, analytics. */
export const VIEW_ROLES = atLeast(WorkspaceRole.VIEWER);

/** Create posts, upload media, edit one's own drafts. */
export const CONTENT_CREATE_ROLES = atLeast(WorkspaceRole.EDITOR);

/** Edit anyone's draft, manage tags/campaigns/templates/snippets, move and rename media. */
export const CONTENT_MANAGE_ROLES = atLeast(WorkspaceRole.MANAGER);

/** Approve or reject a post awaiting review. */
export const APPROVAL_ROLES = atLeast(WorkspaceRole.MANAGER);

/** Schedule, publish now, cancel a scheduled post, retry a failed target. */
export const PUBLISH_ROLES = atLeast(WorkspaceRole.MANAGER);

/** Connect or disconnect the social accounts a workspace publishes through. */
export const MANAGE_CONNECTIONS_ROLES = atLeast(WorkspaceRole.MANAGER);

/** Delete media, delete an already-published post, change workspace-wide policy. */
export const DESTRUCTIVE_ROLES = atLeast(WorkspaceRole.ADMIN);
