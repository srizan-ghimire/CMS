import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ApprovalStatus, NotificationType, PostStatus, Prisma, WorkspaceRole } from "@prisma/client";
import type {
  ApprovalPolicyDto,
  CommentDto,
  CreateCommentInput,
  DecideApprovalInput,
  PostApprovalDto,
  PostVersionDto,
  RequestApprovalInput,
  UpdateApprovalPolicyInput,
} from "@social-platform/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { APPROVAL_ROLES, CONTENT_CREATE_ROLES, VIEW_ROLES } from "../workspaces/lib/roles";

const DEFAULT_POLICY: ApprovalPolicyDto = {
  enabled: false,
  requiredApprovals: 1,
  approverRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER],
  allowAuthorSelfApprove: false,
};

/**
 * Version history, the approval workflow, and internal comments — the three things that turn a
 * post from a document into a reviewable piece of content.
 */
@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  /* -------------------------------- Versions -------------------------------- */

  /**
   * Writes a version row. Called inside the same transaction as the post update it describes, so
   * history can never miss an edit or record one that was rolled back.
   */
  async recordVersion(
    tx: Prisma.TransactionClient,
    postId: string,
    editedById: string,
    changeSummary?: string,
  ): Promise<number> {
    const post = await tx.post.findUniqueOrThrow({
      where: { id: postId },
      include: {
        media: { orderBy: { position: "asc" }, select: { mediaAssetId: true, position: true } },
        targets: {
          include: { media: { orderBy: { position: "asc" }, select: { mediaAssetId: true } } },
        },
        tags: { select: { tagId: true } },
      },
    });

    // Claim the number by incrementing first and using what comes back, rather than reading
    // `post.currentVersion` and writing it. The read-then-write order let two concurrent edits —
    // two tabs on one draft, or two collaborators — both see version N and collide on
    // @@unique([postId, versionNumber]), turning a routine save into a 500. The UPDATE takes a row
    // lock, so the second transaction blocks here and resumes with N+1.
    const { currentVersion: nextVersion } = await tx.post.update({
      where: { id: postId },
      data: { currentVersion: { increment: 1 } },
      select: { currentVersion: true },
    });
    const versionNumber = nextVersion - 1;

    // The snapshot is the whole post, not just its text: restoring content alone would silently
    // drop the media order and per-platform overrides that make the version meaningful.
    const snapshot = {
      title: post.title,
      content: post.content,
      contentJson: post.contentJson ?? null,
      firstComment: post.firstComment,
      scheduledAt: post.scheduledAt?.toISOString() ?? null,
      timezone: post.timezone,
      campaignId: post.campaignId,
      mediaAssetIds: post.media.map((m) => m.mediaAssetId),
      tagIds: post.tags.map((t) => t.tagId),
      targets: post.targets.map((t) => ({
        socialAccountId: t.socialAccountId,
        contentOverride: t.contentOverride,
        contentJsonOverride: t.contentJsonOverride ?? null,
        firstCommentOverride: t.firstCommentOverride,
        platformOptions: t.platformOptions ?? null,
        mediaAssetIds: t.media.map((m) => m.mediaAssetId),
      })),
    };

    await tx.postVersion.create({
      data: {
        postId,
        versionNumber,
        title: post.title,
        content: post.content,
        contentJson: post.contentJson ?? Prisma.DbNull,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        changeSummary: changeSummary ?? null,
        editedById,
      },
    });

    return versionNumber;
  }

  async listVersions(postId: string, userId: string): Promise<PostVersionDto[]> {
    const post = await this.loadPost(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, VIEW_ROLES);

    const versions = await this.prisma.postVersion.findMany({
      where: { postId },
      orderBy: { versionNumber: "desc" },
      include: { editedBy: { select: { name: true } } },
    });

    return versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      title: v.title,
      content: v.content,
      changeSummary: v.changeSummary,
      editedById: v.editedById,
      editedByName: v.editedBy?.name ?? null,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  /**
   * Restores by writing a NEW version from an old snapshot. History is append-only — rewriting it
   * would destroy the record of what was actually published at any point in time.
   */
  async restoreVersion(postId: string, versionNumber: number, userId: string): Promise<void> {
    const post = await this.loadPost(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, CONTENT_CREATE_ROLES);

    const version = await this.prisma.postVersion.findUnique({
      where: { postId_versionNumber: { postId, versionNumber } },
    });
    if (!version) throw new NotFoundException(`Version ${versionNumber} not found.`);

    const snapshot = version.snapshot as {
      title: string | null;
      content: string;
      contentJson: unknown;
      firstComment: string | null;
      mediaAssetIds: string[];
      targets: {
        socialAccountId: string;
        contentOverride: string | null;
        contentJsonOverride: unknown;
        firstCommentOverride: string | null;
        platformOptions: unknown;
        mediaAssetIds: string[];
      }[];
    };

    await this.prisma.$transaction(async (tx) => {
      // Snapshot the current state first, so "restore" is itself undoable.
      await this.recordVersion(tx, postId, userId, `Restored from v${versionNumber}`);

      await tx.post.update({
        where: { id: postId },
        data: {
          title: snapshot.title,
          content: snapshot.content,
          contentJson: (snapshot.contentJson as Prisma.InputJsonValue) ?? Prisma.DbNull,
          firstComment: snapshot.firstComment,
          updatedById: userId,
        },
      });

      await tx.postMedia.deleteMany({ where: { postId } });
      // Assets may have been deleted since the snapshot was taken, so only restore what still
      // exists rather than failing the whole restore on a missing FK.
      const surviving = await tx.mediaAsset.findMany({
        where: { id: { in: snapshot.mediaAssetIds }, deletedAt: null },
        select: { id: true },
      });
      const survivingIds = new Set(surviving.map((a) => a.id));
      await tx.postMedia.createMany({
        data: snapshot.mediaAssetIds
          .filter((id) => survivingIds.has(id))
          .map((mediaAssetId, position) => ({ postId, mediaAssetId, position })),
      });
    });
  }

  /* -------------------------------- Approvals ------------------------------- */

  async getPolicy(workspaceId: string, userId: string): Promise<ApprovalPolicyDto> {
    await this.workspaces.assertMembership(workspaceId, userId, VIEW_ROLES);
    const policy = await this.prisma.approvalPolicy.findUnique({ where: { workspaceId } });
    if (!policy) return DEFAULT_POLICY;
    return {
      enabled: policy.enabled,
      requiredApprovals: policy.requiredApprovals,
      approverRoles: policy.approverRoles,
      allowAuthorSelfApprove: policy.allowAuthorSelfApprove,
    };
  }

  async updatePolicy(
    workspaceId: string,
    input: UpdateApprovalPolicyInput,
    userId: string,
  ): Promise<ApprovalPolicyDto> {
    // Changing who can sign off on content is an admin-level decision.
    await this.workspaces.assertMembership(workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    const roles = input.approverRoles as WorkspaceRole[] | undefined;
    const policy = await this.prisma.approvalPolicy.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        enabled: input.enabled ?? DEFAULT_POLICY.enabled,
        requiredApprovals: input.requiredApprovals ?? DEFAULT_POLICY.requiredApprovals,
        approverRoles: roles ?? DEFAULT_POLICY.approverRoles,
        allowAuthorSelfApprove: input.allowAuthorSelfApprove ?? DEFAULT_POLICY.allowAuthorSelfApprove,
      },
      update: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.requiredApprovals !== undefined
          ? { requiredApprovals: input.requiredApprovals }
          : {}),
        ...(roles ? { approverRoles: roles } : {}),
        ...(input.allowAuthorSelfApprove !== undefined
          ? { allowAuthorSelfApprove: input.allowAuthorSelfApprove }
          : {}),
      },
    });

    return {
      enabled: policy.enabled,
      requiredApprovals: policy.requiredApprovals,
      approverRoles: policy.approverRoles,
      allowAuthorSelfApprove: policy.allowAuthorSelfApprove,
    };
  }

  async requestApproval(
    postId: string,
    input: RequestApprovalInput,
    userId: string,
  ): Promise<PostApprovalDto[]> {
    const post = await this.loadPost(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, CONTENT_CREATE_ROLES);

    if (post.status !== PostStatus.DRAFT) {
      throw new ConflictException(
        `Only drafts can be sent for approval (this post is ${post.status.toLowerCase()}).`,
      );
    }

    const policy = await this.getPolicy(post.workspaceId, userId);
    const reviewers = await this.resolveReviewers(post.workspaceId, input.reviewerIds, policy, post.authorId);
    if (reviewers.length === 0) {
      throw new BadRequestException("No eligible reviewers in this workspace.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: { status: PostStatus.PENDING_APPROVAL },
      });

      await tx.postApproval.createMany({
        data: reviewers.map((reviewerId) => ({
          postId,
          reviewerId,
          round: post.approvalRound,
          status: ApprovalStatus.PENDING,
          note: input.note ?? null,
          requestedById: userId,
        })),
        skipDuplicates: true,
      });

      await tx.notification.createMany({
        data: reviewers.map((reviewerId) => ({
          workspaceId: post.workspaceId,
          userId: reviewerId,
          type: NotificationType.APPROVAL_REQUEST,
          title: "A post needs your review",
          body: `"${post.title ?? post.content.slice(0, 60)}" is waiting for approval.`,
        })),
      });
    });

    return this.listApprovals(postId, userId);
  }

  async decide(
    approvalId: string,
    input: DecideApprovalInput,
    userId: string,
  ): Promise<{ postStatus: PostStatus }> {
    const approval = await this.prisma.postApproval.findUnique({
      where: { id: approvalId },
      include: { post: true },
    });
    if (!approval) throw new NotFoundException("Approval not found.");

    await this.workspaces.assertMembership(approval.post.workspaceId, userId, APPROVAL_ROLES);
    if (approval.reviewerId !== userId) {
      throw new ForbiddenException("This review is assigned to someone else.");
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new ConflictException("This review has already been decided.");
    }
    // A decision on a superseded round is stale — the content it approved no longer exists.
    if (approval.round !== approval.post.approvalRound) {
      throw new ConflictException(
        "The post changed after this review was requested. A new review round is required.",
      );
    }

    const policy = await this.getPolicy(approval.post.workspaceId, userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.postApproval.update({
        where: { id: approvalId },
        data: {
          status: input.decision as ApprovalStatus,
          note: input.note ?? null,
          decidedAt: new Date(),
        },
      });

      if (input.decision === "REJECTED") {
        // Back to DRAFT and bump the round so the author must explicitly re-request after edits.
        await tx.post.update({
          where: { id: approval.postId },
          data: { status: PostStatus.DRAFT, approvalRound: { increment: 1 } },
        });
        await tx.notification.create({
          data: {
            workspaceId: approval.post.workspaceId,
            userId: approval.post.authorId,
            type: NotificationType.APPROVAL_REQUEST,
            title: "Changes requested",
            body: input.note ?? "A reviewer requested changes to your post.",
          },
        });
        return { postStatus: PostStatus.DRAFT };
      }

      const approvedCount = await tx.postApproval.count({
        where: {
          postId: approval.postId,
          round: approval.round,
          status: ApprovalStatus.APPROVED,
        },
      });

      if (approvedCount < policy.requiredApprovals) {
        return { postStatus: approval.post.status };
      }

      // Enough sign-offs: schedule it if a time was set, otherwise leave it an approved draft
      // ready to publish now.
      const nextStatus = approval.post.scheduledAt ? PostStatus.SCHEDULED : PostStatus.DRAFT;
      await tx.post.update({ where: { id: approval.postId }, data: { status: nextStatus } });
      await tx.notification.create({
        data: {
          workspaceId: approval.post.workspaceId,
          userId: approval.post.authorId,
          type: NotificationType.APPROVAL_REQUEST,
          title: "Post approved",
          body: `"${approval.post.title ?? "Your post"}" was approved.`,
        },
      });
      return { postStatus: nextStatus };
    });
  }

  async listApprovals(postId: string, userId: string): Promise<PostApprovalDto[]> {
    const post = await this.loadPost(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, VIEW_ROLES);

    const approvals = await this.prisma.postApproval.findMany({
      where: { postId },
      orderBy: [{ round: "desc" }, { createdAt: "asc" }],
      include: { reviewer: { select: { name: true } } },
    });

    return approvals.map((a) => ({
      id: a.id,
      postId: a.postId,
      reviewerId: a.reviewerId,
      reviewerName: a.reviewer.name,
      round: a.round,
      status: a.status,
      note: a.note,
      decidedAt: a.decidedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  /** The signed-in user's outstanding reviews, across every workspace they belong to. */
  async myQueue(userId: string): Promise<PostApprovalDto[]> {
    const approvals = await this.prisma.postApproval.findMany({
      where: {
        reviewerId: userId,
        status: ApprovalStatus.PENDING,
        post: { deletedAt: null, status: PostStatus.PENDING_APPROVAL },
      },
      orderBy: { createdAt: "asc" },
      include: { reviewer: { select: { name: true } } },
    });

    return approvals.map((a) => ({
      id: a.id,
      postId: a.postId,
      reviewerId: a.reviewerId,
      reviewerName: a.reviewer.name,
      round: a.round,
      status: a.status,
      note: a.note,
      decidedAt: null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  /**
   * Invalidates an in-flight review round after a content edit. Called by PostsService.update —
   * without it, a reviewer's approval would silently carry over to text they never saw.
   */
  async invalidateRoundIfPending(tx: Prisma.TransactionClient, postId: string): Promise<boolean> {
    const post = await tx.post.findUnique({
      where: { id: postId },
      select: { status: true, approvalRound: true },
    });
    if (!post || post.status !== PostStatus.PENDING_APPROVAL) return false;

    await tx.post.update({
      where: { id: postId },
      data: { status: PostStatus.DRAFT, approvalRound: { increment: 1 } },
    });
    return true;
  }

  /* --------------------------------- Comments -------------------------------- */

  async listComments(postId: string, userId: string): Promise<CommentDto[]> {
    const post = await this.loadPost(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, VIEW_ROLES);

    const comments = await this.prisma.comment.findMany({
      where: { postId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true } } },
    });

    const toDto = (c: (typeof comments)[number]): CommentDto => ({
      id: c.id,
      postId: c.postId,
      parentId: c.parentId,
      authorId: c.authorId,
      authorName: c.author.name,
      body: c.body,
      mentionedUserIds: c.mentionedUserIds,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      replies: [],
    });

    // Assemble one level of threading in memory — a post's comment count is small enough that a
    // recursive query would be more machinery than the problem deserves.
    const byId = new Map(comments.map((c) => [c.id, toDto(c)]));
    const roots: CommentDto[] = [];
    for (const comment of comments) {
      const dto = byId.get(comment.id)!;
      if (comment.parentId && byId.has(comment.parentId)) {
        byId.get(comment.parentId)!.replies.push(dto);
      } else {
        roots.push(dto);
      }
    }
    return roots;
  }

  async addComment(
    postId: string,
    input: CreateCommentInput,
    userId: string,
  ): Promise<CommentDto> {
    const post = await this.loadPost(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, VIEW_ROLES);

    if (input.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: input.parentId, postId, deletedAt: null },
      });
      if (!parent) throw new NotFoundException("Parent comment not found on this post.");
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId: userId,
        parentId: input.parentId ?? null,
        body: input.body,
        mentionedUserIds: input.mentionedUserIds,
      },
      include: { author: { select: { name: true } } },
    });

    if (input.mentionedUserIds.length > 0) {
      await this.prisma.notification.createMany({
        data: input.mentionedUserIds.map((mentionedId) => ({
          workspaceId: post.workspaceId,
          userId: mentionedId,
          type: NotificationType.APPROVAL_REQUEST,
          title: "You were mentioned",
          body: input.body.slice(0, 140),
        })),
      });
    }

    return {
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      authorId: comment.authorId,
      authorName: comment.author.name,
      body: comment.body,
      mentionedUserIds: comment.mentionedUserIds,
      resolvedAt: null,
      createdAt: comment.createdAt.toISOString(),
      replies: [],
    };
  }

  async resolveComment(commentId: string, resolved: boolean, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      include: { post: { select: { workspaceId: true } } },
    });
    if (!comment) throw new NotFoundException("Comment not found.");
    await this.workspaces.assertMembership(comment.post.workspaceId, userId, VIEW_ROLES);

    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        resolvedAt: resolved ? new Date() : null,
        resolvedById: resolved ? userId : null,
      },
    });
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      include: { post: { select: { workspaceId: true } } },
    });
    if (!comment) throw new NotFoundException("Comment not found.");

    // Authors delete their own; anyone else needs MANAGER+.
    if (comment.authorId !== userId) {
      await this.workspaces.assertMembership(comment.post.workspaceId, userId, APPROVAL_ROLES);
    } else {
      await this.workspaces.assertMembership(comment.post.workspaceId, userId, VIEW_ROLES);
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  /* -------------------------------- Internals ------------------------------- */

  private async loadPost(postId: string) {
    const post = await this.prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException("Post not found.");
    return post;
  }

  private async resolveReviewers(
    workspaceId: string,
    requested: string[],
    policy: ApprovalPolicyDto,
    authorId: string,
  ): Promise<string[]> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        ownerId: true,
        members: { where: { role: { in: policy.approverRoles } }, select: { userId: true } },
      },
    });

    // The owner is an implicit OWNER without needing a WorkspaceMember row (same rule as
    // assertMembership), so add them explicitly when OWNER is an approver role.
    const eligible = new Set(workspace.members.map((m) => m.userId));
    if (policy.approverRoles.includes(WorkspaceRole.OWNER)) eligible.add(workspace.ownerId);
    if (!policy.allowAuthorSelfApprove) eligible.delete(authorId);

    if (requested.length === 0) return Array.from(eligible);

    const invalid = requested.filter((id) => !eligible.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException("One or more chosen reviewers are not eligible to approve.");
    }
    return requested;
  }
}
