import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, PostStatus, SocialAccountStatus } from "@prisma/client";
import {
  PLATFORM_LIMITS,
  isPostEditable,
  validateAgainstPlatform,
  type CreatePostInput,
  type ListPostsQuery,
  type PostDto,
  type PostTargetDto,
  type PostTargetInput,
  type SocialPlatform,
  type TargetValidation,
  type UpdatePostInput,
} from "@social-platform/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { CONTENT_CREATE_ROLES, CONTENT_MANAGE_ROLES, VIEW_ROLES } from "../workspaces/lib/roles";
import { MediaService } from "../media/media.service";
import { proseMirrorToPlainText, resolveContent } from "./lib/content-serializer";
import { ApprovalsService } from "./approvals.service";
import { AuditService } from "../../common/audit/audit.service";

/** Everything the DTO mapper needs; kept in one include so reads stay consistent. */
const POST_INCLUDE = {
  media: {
    orderBy: { position: "asc" },
    include: {
      asset: {
        include: {
          variants: true,
          tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
        },
      },
    },
  },
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
  targets: {
    orderBy: { createdAt: "asc" },
    include: {
      socialAccount: true,
      media: { orderBy: { position: "asc" }, select: { mediaAssetId: true } },
    },
  },
} satisfies Prisma.PostInclude;

type PostWithRelations = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly media: MediaService,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService,
  ) {}

  /* --------------------------------- Create --------------------------------- */

  async create(input: CreatePostInput, userId: string): Promise<PostDto> {
    await this.workspaces.assertMembership(input.workspaceId, userId, CONTENT_CREATE_ROLES);

    const content = this.deriveContent(input.content, input.contentJson);
    await this.assertMediaInWorkspace(input.mediaAssetIds, input.workspaceId);
    await this.assertAccountsInWorkspace(
      input.targets.map((t) => t.socialAccountId),
      input.workspaceId,
    );

    const post = await this.prisma.post.create({
      data: {
        workspaceId: input.workspaceId,
        authorId: userId,
        updatedById: userId,
        title: input.title ?? null,
        content,
        contentJson: toJson(input.contentJson),
        firstComment: input.firstComment ?? null,
        timezone: input.timezone,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        campaignId: input.campaignId ?? null,
        recurrenceRule: input.recurrenceRule ?? null,
        recurrenceEndsAt: input.recurrenceEndsAt ? new Date(input.recurrenceEndsAt) : null,
        recurrenceCount: input.recurrenceCount ?? null,
        status: PostStatus.DRAFT,
        media: {
          create: input.mediaAssetIds.map((mediaAssetId, position) => ({ mediaAssetId, position })),
        },
        targets: { create: input.targets.map((t) => this.targetCreateData(t)) },
      },
      include: POST_INCLUDE,
    });

    this.audit.record({
      workspaceId: input.workspaceId,
      userId,
      action: "post.create",
      entityType: "Post",
      entityId: post.id,
      metadata: { targets: input.targets.length, media: input.mediaAssetIds.length },
    });

    return this.toDto(post);
  }

  /* ---------------------------------- Reads --------------------------------- */

  async findMany(query: ListPostsQuery, userId: string) {
    await this.workspaces.assertMembership(query.workspaceId, userId, VIEW_ROLES);

    const where: Prisma.PostWhereInput = {
      workspaceId: query.workspaceId,
      deletedAt: null,
      ...(query.includeArchived ? {} : { archivedAt: null }),
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.socialAccountId
        ? { targets: { some: { socialAccountId: query.socialAccountId } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" as const } },
              { content: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            scheduledAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const items = await this.prisma.post.findMany({
      where,
      include: POST_INCLUDE,
      orderBy: { updatedAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;
    return {
      items: page.map((post) => this.toDto(post)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async findOne(postId: string, userId: string): Promise<PostDto> {
    const post = await this.loadPost(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, VIEW_ROLES);
    return this.toDto(post);
  }

  /* -------------------------------- Mutations ------------------------------- */

  async update(postId: string, input: UpdatePostInput, userId: string): Promise<PostDto> {
    const post = await this.loadPost(postId);
    await this.assertCanEdit(post, userId);

    if (!isPostEditable(post.status)) {
      throw new ConflictException(
        `This post is ${post.status.toLowerCase().replace("_", " ")} and can no longer be edited.`,
      );
    }

    if (input.mediaAssetIds) {
      await this.assertMediaInWorkspace(input.mediaAssetIds, post.workspaceId);
    }
    if (input.targets) {
      await this.assertAccountsInWorkspace(
        input.targets.map((t) => t.socialAccountId),
        post.workspaceId,
      );
    }

    const content =
      input.content !== undefined || input.contentJson !== undefined
        ? this.deriveContent(input.content ?? post.content, input.contentJson)
        : undefined;

    // A content change (as opposed to only re-scheduling) is what makes a new version worth
    // keeping and what invalidates an in-flight review.
    const contentChanged =
      input.content !== undefined ||
      input.contentJson !== undefined ||
      input.title !== undefined ||
      input.firstComment !== undefined ||
      input.mediaAssetIds !== undefined ||
      input.targets !== undefined;

    await this.prisma.$transaction(async (tx) => {
      if (contentChanged) {
        await this.approvals.recordVersion(tx, postId, userId);
        // Approving text and then editing it would leave a sign-off attached to content nobody
        // reviewed, so any edit mid-review sends the post back to DRAFT on a fresh round.
        await this.approvals.invalidateRoundIfPending(tx, postId);
      }

      await tx.post.update({
        where: { id: postId },
        data: {
          updatedById: userId,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(content !== undefined ? { content } : {}),
          ...(input.contentJson !== undefined ? { contentJson: toJson(input.contentJson) } : {}),
          ...(input.firstComment !== undefined ? { firstComment: input.firstComment } : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
          ...(input.scheduledAt !== undefined
            ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
            : {}),
          ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
          ...(input.recurrenceRule !== undefined ? { recurrenceRule: input.recurrenceRule } : {}),
          ...(input.recurrenceEndsAt !== undefined
            ? { recurrenceEndsAt: input.recurrenceEndsAt ? new Date(input.recurrenceEndsAt) : null }
            : {}),
          ...(input.recurrenceCount !== undefined
            ? { recurrenceCount: input.recurrenceCount }
            : {}),
        },
      });

      // Media and targets arrive as full replacements. Replacing media wholesale is safe (it
      // carries no state), but targets are diffed rather than recreated because a target holds
      // publish state that must survive an edit.
      if (input.mediaAssetIds) {
        await tx.postMedia.deleteMany({ where: { postId } });
        await tx.postMedia.createMany({
          data: input.mediaAssetIds.map((mediaAssetId, position) => ({
            postId,
            mediaAssetId,
            position,
          })),
        });
      }

      if (input.targets) await this.syncTargets(tx, postId, input.targets);
    });

    return this.toDto(await this.loadPost(postId));
  }

  /**
   * Diffs the requested target set against what exists. Targets carry publish state, so an
   * already-PUBLISHED target is never dropped — silently deleting it would erase the record that
   * the post went out on that account.
   */
  private async syncTargets(
    tx: Prisma.TransactionClient,
    postId: string,
    targets: PostTargetInput[],
  ): Promise<void> {
    const existing = await tx.postTarget.findMany({ where: { postId } });
    const requested = new Map(targets.map((t) => [t.socialAccountId, t]));

    const removable = existing.filter(
      (t) => !requested.has(t.socialAccountId) && t.status !== "PUBLISHED" && t.status !== "PUBLISHING",
    );
    if (removable.length > 0) {
      await tx.postTarget.deleteMany({ where: { id: { in: removable.map((t) => t.id) } } });
    }

    for (const target of targets) {
      const match = existing.find((t) => t.socialAccountId === target.socialAccountId);
      const data = this.targetCreateData(target);

      if (!match) {
        await tx.postTarget.create({ data: { ...data, postId } });
        continue;
      }
      // Content of an already-published target is history; leave it exactly as sent.
      if (match.status === "PUBLISHED" || match.status === "PUBLISHING") continue;

      await tx.postTarget.update({
        where: { id: match.id },
        data: {
          contentOverride: data.contentOverride,
          contentJsonOverride: data.contentJsonOverride,
          firstCommentOverride: data.firstCommentOverride,
          platformOptions: data.platformOptions,
        },
      });
      await tx.postTargetMedia.deleteMany({ where: { postTargetId: match.id } });
      if (target.mediaAssetIds?.length) {
        await tx.postTargetMedia.createMany({
          data: target.mediaAssetIds.map((mediaAssetId, position) => ({
            postTargetId: match.id,
            mediaAssetId,
            position,
          })),
        });
      }
    }
  }

  async duplicate(postId: string, userId: string): Promise<PostDto> {
    const post = await this.loadPost(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, CONTENT_CREATE_ROLES);

    const copy = await this.prisma.post.create({
      data: {
        workspaceId: post.workspaceId,
        authorId: userId,
        updatedById: userId,
        title: post.title ? `${post.title} (copy)` : null,
        content: post.content,
        contentJson: post.contentJson ?? Prisma.DbNull,
        firstComment: post.firstComment,
        timezone: post.timezone,
        // A duplicate is always a fresh draft: copying the schedule would silently queue a second
        // publish at the original time.
        status: PostStatus.DRAFT,
        scheduledAt: null,
        media: {
          create: post.media.map((m) => ({ mediaAssetId: m.mediaAssetId, position: m.position })),
        },
        targets: {
          create: post.targets.map((t) => ({
            socialAccountId: t.socialAccountId,
            contentOverride: t.contentOverride,
            contentJsonOverride: t.contentJsonOverride ?? Prisma.DbNull,
            firstCommentOverride: t.firstCommentOverride,
            platformOptions: t.platformOptions ?? Prisma.DbNull,
          })),
        },
      },
      include: POST_INCLUDE,
    });

    return this.toDto(copy);
  }

  async setArchived(postId: string, archived: boolean, userId: string): Promise<PostDto> {
    const post = await this.loadPost(postId);
    await this.assertCanEdit(post, userId);
    await this.prisma.post.update({
      where: { id: postId },
      data: { archivedAt: archived ? new Date() : null, updatedById: userId },
    });
    return this.toDto(await this.loadPost(postId));
  }

  async remove(postId: string, userId: string): Promise<void> {
    const post = await this.loadPost(postId);

    // Deleting something already published removes it from the workspace's own record of what
    // went out, so that needs a higher bar than deleting a draft.
    const published = post.targets.some((t) => t.status === "PUBLISHED");
    await this.workspaces.assertMembership(
      post.workspaceId,
      userId,
      published ? CONTENT_MANAGE_ROLES : CONTENT_CREATE_ROLES,
    );
    if (!published && post.authorId !== userId) {
      await this.workspaces.assertMembership(post.workspaceId, userId, CONTENT_MANAGE_ROLES);
    }

    await this.prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });

    this.audit.record({
      workspaceId: post.workspaceId,
      userId,
      action: "post.delete",
      entityType: "Post",
      entityId: postId,
      metadata: { hadPublishedTargets: published },
    });
  }

  async restore(postId: string, userId: string): Promise<PostDto> {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, include: POST_INCLUDE });
    if (!post) throw new NotFoundException("Post not found.");
    await this.workspaces.assertMembership(post.workspaceId, userId, CONTENT_MANAGE_ROLES);
    await this.prisma.post.update({ where: { id: postId }, data: { deletedAt: null } });
    return this.toDto(await this.loadPost(postId));
  }

  /* -------------------------------- Validation ------------------------------ */

  /**
   * Runs the shared platform rules for every target. The composer calls this on change so limit
   * violations surface in the editor — by the time a publish job fails, the user has already
   * walked away.
   */
  async validate(postId: string, userId: string): Promise<TargetValidation[]> {
    const post = await this.loadPost(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, VIEW_ROLES);
    return this.validatePost(post);
  }

  validatePost(post: PostWithRelations): TargetValidation[] {
    const postMedia = post.media.map((m) => m.asset);

    return post.targets.map((target) => {
      const platform = target.socialAccount.platform as SocialPlatform;
      const { content } = resolveContent(post, target);

      // A target with its own media overrides the post's entirely; empty means inherit.
      const overrideIds = target.media.map((m) => m.mediaAssetId);
      const media = overrideIds.length
        ? overrideIds.flatMap((id) => {
            const asset = postMedia.find((a) => a.id === id);
            return asset ? [asset] : [];
          })
        : postMedia;

      const errors = validateAgainstPlatform(
        platform,
        content,
        media.map((asset) => ({
          type: asset.type,
          sizeBytes: asset.sizeBytes,
          width: asset.width,
          height: asset.height,
          durationMs: asset.durationMs,
        })),
      );

      // Platform rules can't see connection health, but publishing to a dead account fails just
      // as surely as an over-long caption — so it belongs in the same list.
      if (target.socialAccount.status !== SocialAccountStatus.CONNECTED) {
        errors.push(
          `${target.socialAccount.displayName} is ${target.socialAccount.status
            .toLowerCase()
            .replace("_", " ")} — reconnect it in Settings → Connections.`,
        );
      }
      if (media.some((asset) => asset.status !== "READY")) {
        errors.push("Some attached media is still processing.");
      }
      if (target.firstCommentOverride && !PLATFORM_LIMITS[platform].supportsFirstComment) {
        errors.push(`${platform} does not support a first comment.`);
      }

      return { socialAccountId: target.socialAccountId, platform, ok: errors.length === 0, errors };
    });
  }

  /* -------------------------------- Internals ------------------------------- */

  /** Exposed so the publish pipeline (Stage 5) loads posts through the owning service. */
  async loadPost(postId: string): Promise<PostWithRelations> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      include: POST_INCLUDE,
    });
    if (!post) throw new NotFoundException("Post not found.");
    return post;
  }

  /** EDITORs may only edit their own drafts; changing someone else's needs MANAGER+. */
  private async assertCanEdit(post: { workspaceId: string; authorId: string }, userId: string) {
    const roles = post.authorId === userId ? CONTENT_CREATE_ROLES : CONTENT_MANAGE_ROLES;
    await this.workspaces.assertMembership(post.workspaceId, userId, roles);
  }

  private deriveContent(fallback: string, contentJson: unknown): string {
    // The rich-text document wins when present: it's what the user actually typed, and the plain
    // string the client sends alongside it is only a convenience copy.
    if (contentJson) return proseMirrorToPlainText(contentJson);
    return fallback;
  }

  private targetCreateData(target: PostTargetInput) {
    return {
      socialAccountId: target.socialAccountId,
      contentOverride: target.contentOverride ?? null,
      contentJsonOverride: toJson(target.contentJsonOverride),
      firstCommentOverride: target.firstCommentOverride ?? null,
      platformOptions: toJson(target.platformOptions),
      ...(target.mediaAssetIds?.length
        ? {
            media: {
              create: target.mediaAssetIds.map((mediaAssetId, position) => ({
                mediaAssetId,
                position,
              })),
            },
          }
        : {}),
    };
  }

  private async assertMediaInWorkspace(assetIds: string[], workspaceId: string): Promise<void> {
    if (assetIds.length === 0) return;
    const unique = Array.from(new Set(assetIds));
    if (unique.length !== assetIds.length) {
      throw new BadRequestException("The same media asset was attached more than once.");
    }
    const found = await this.media.countInWorkspace(unique, workspaceId);
    if (found !== unique.length) {
      throw new BadRequestException("One or more media assets are not in this workspace.");
    }
  }

  private async assertAccountsInWorkspace(
    accountIds: string[],
    workspaceId: string,
  ): Promise<void> {
    if (accountIds.length === 0) return;
    const unique = Array.from(new Set(accountIds));
    if (unique.length !== accountIds.length) {
      throw new BadRequestException("The same account was targeted more than once.");
    }
    const count = await this.prisma.socialAccount.count({
      where: { id: { in: unique }, workspaceId },
    });
    if (count !== unique.length) {
      throw new ForbiddenException("One or more accounts do not belong to this workspace.");
    }
  }

  private toDto(post: PostWithRelations): PostDto {
    return {
      id: post.id,
      workspaceId: post.workspaceId,
      authorId: post.authorId,
      title: post.title,
      content: post.content,
      contentJson: post.contentJson ?? null,
      firstComment: post.firstComment,
      status: post.status,
      timezone: post.timezone,
      scheduledAt: post.scheduledAt?.toISOString() ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      archivedAt: post.archivedAt?.toISOString() ?? null,
      currentVersion: post.currentVersion,
      campaignId: post.campaignId,
      tags: post.tags.map((t) => t.tag),
      recurrenceRule: post.recurrenceRule,
      media: post.media.map((m) => this.media.toDto(m.asset)),
      targets: post.targets.map(
        (target): PostTargetDto => ({
          id: target.id,
          socialAccountId: target.socialAccountId,
          platform: target.socialAccount.platform as SocialPlatform,
          accountName: target.socialAccount.displayName,
          accountHandle: target.socialAccount.handle,
          accountAvatarUrl: target.socialAccount.avatarUrl,
          status: target.status,
          contentOverride: target.contentOverride,
          firstCommentOverride: target.firstCommentOverride,
          platformOptions: (target.platformOptions as Record<string, unknown> | null) ?? null,
          mediaAssetIds: target.media.map((m) => m.mediaAssetId),
          platformPostId: target.platformPostId,
          permalink: null,
          errorMessage: target.errorMessage,
          attempts: target.attempts,
          publishedAt: target.publishedAt?.toISOString() ?? null,
        }),
      ),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}

/**
 * Prisma distinguishes "leave this JSON column alone" (undefined) from "set it to SQL NULL"
 * (DbNull); passing a plain `null` throws. Callers only ever mean the latter.
 */
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}
