import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  applyTemplateVariables,
  extractTemplateVariables,
  slugifyTag,
  type CampaignDto,
  type CreateCampaignInput,
  type CreateSnippetInput,
  type CreateTagInput,
  type CreateTemplateInput,
  type InstantiateTemplateInput,
  type SnippetDto,
  type SocialPlatform,
  type TagDto,
  type TemplateDto,
  type UpdateCampaignInput,
  type UpdateSnippetInput,
  type UpdateTagInput,
  type UpdateTemplateInput,
} from "@social-platform/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { CONTENT_CREATE_ROLES, CONTENT_MANAGE_ROLES, VIEW_ROLES } from "../workspaces/lib/roles";

/**
 * Tags, campaigns, templates and snippets. Four small CRUD surfaces that all answer the same
 * question — "how is this workspace's content organised" — so they share a module rather than
 * each getting one.
 */
@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  /* ----------------------------------- Tags --------------------------------- */

  async listTags(workspaceId: string, userId: string): Promise<TagDto[]> {
    await this.workspaces.assertMembership(workspaceId, userId, VIEW_ROLES);
    const tags = await this.prisma.tag.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: true, assets: true } } },
    });
    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
      postCount: tag._count.posts,
      assetCount: tag._count.assets,
    }));
  }

  async createTag(input: CreateTagInput, userId: string): Promise<TagDto> {
    await this.workspaces.assertMembership(input.workspaceId, userId, CONTENT_CREATE_ROLES);
    try {
      const tag = await this.prisma.tag.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          slug: slugifyTag(input.name),
          color: input.color ?? null,
          createdById: userId,
        },
      });
      return { id: tag.id, name: tag.name, slug: tag.slug, color: tag.color, postCount: 0, assetCount: 0 };
    } catch (err) {
      throw this.conflictOrRethrow(err, "A tag with that name already exists.");
    }
  }

  async updateTag(tagId: string, input: UpdateTagInput, userId: string): Promise<TagDto> {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException("Tag not found.");
    await this.workspaces.assertMembership(tag.workspaceId, userId, CONTENT_MANAGE_ROLES);

    try {
      const updated = await this.prisma.tag.update({
        where: { id: tagId },
        data: {
          ...(input.name !== undefined ? { name: input.name, slug: slugifyTag(input.name) } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        },
        include: { _count: { select: { posts: true, assets: true } } },
      });
      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        color: updated.color,
        postCount: updated._count.posts,
        assetCount: updated._count.assets,
      };
    } catch (err) {
      throw this.conflictOrRethrow(err, "A tag with that name already exists.");
    }
  }

  async deleteTag(tagId: string, userId: string): Promise<void> {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException("Tag not found.");
    await this.workspaces.assertMembership(tag.workspaceId, userId, CONTENT_MANAGE_ROLES);
    // Hard delete: the join rows cascade, and an untagged post is a perfectly valid state — there
    // is nothing here worth preserving the way a published post's media is.
    await this.prisma.tag.delete({ where: { id: tagId } });
  }

  /** Replaces the full tag set on a post or asset. Used by both the composer and the media drawer. */
  async setTags(
    entity: "post" | "media",
    entityId: string,
    tagIds: string[],
    userId: string,
  ): Promise<void> {
    const workspaceId = await this.resolveWorkspace(entity, entityId);
    await this.workspaces.assertMembership(workspaceId, userId, CONTENT_CREATE_ROLES);

    if (tagIds.length > 0) {
      const valid = await this.prisma.tag.count({ where: { id: { in: tagIds }, workspaceId } });
      if (valid !== tagIds.length) {
        throw new NotFoundException("One or more tags are not in this workspace.");
      }
    }

    if (entity === "post") {
      await this.prisma.$transaction([
        this.prisma.postTag.deleteMany({ where: { postId: entityId } }),
        this.prisma.postTag.createMany({ data: tagIds.map((tagId) => ({ postId: entityId, tagId })) }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.mediaAssetTag.deleteMany({ where: { mediaAssetId: entityId } }),
        this.prisma.mediaAssetTag.createMany({
          data: tagIds.map((tagId) => ({ mediaAssetId: entityId, tagId })),
        }),
      ]);
    }
  }

  /* --------------------------------- Campaigns ------------------------------- */

  async listCampaigns(workspaceId: string, userId: string): Promise<CampaignDto[]> {
    await this.workspaces.assertMembership(workspaceId, userId, VIEW_ROLES);
    const campaigns = await this.prisma.campaign.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { posts: { where: { deletedAt: null } } } },
        posts: { where: { deletedAt: null, status: "PUBLISHED" }, select: { id: true } },
      },
    });
    return campaigns.map((c) => this.toCampaignDto(c, c._count.posts, c.posts.length));
  }

  async createCampaign(input: CreateCampaignInput, userId: string): Promise<CampaignDto> {
    await this.workspaces.assertMembership(input.workspaceId, userId, CONTENT_MANAGE_ROLES);
    try {
      const campaign = await this.prisma.campaign.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? null,
          goal: input.goal ?? null,
          status: input.status,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          createdById: userId,
        },
      });
      return this.toCampaignDto(campaign, 0, 0);
    } catch (err) {
      throw this.conflictOrRethrow(err, "A campaign with that name already exists.");
    }
  }

  async updateCampaign(
    campaignId: string,
    input: UpdateCampaignInput,
    userId: string,
  ): Promise<CampaignDto> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, deletedAt: null },
    });
    if (!campaign) throw new NotFoundException("Campaign not found.");
    await this.workspaces.assertMembership(campaign.workspaceId, userId, CONTENT_MANAGE_ROLES);

    try {
      const updated = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.goal !== undefined ? { goal: input.goal } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.startsAt !== undefined
            ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
            : {}),
          ...(input.endsAt !== undefined
            ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
            : {}),
        },
        include: {
          _count: { select: { posts: { where: { deletedAt: null } } } },
          posts: { where: { deletedAt: null, status: "PUBLISHED" }, select: { id: true } },
        },
      });
      return this.toCampaignDto(updated, updated._count.posts, updated.posts.length);
    } catch (err) {
      throw this.conflictOrRethrow(err, "A campaign with that name already exists.");
    }
  }

  async deleteCampaign(campaignId: string, userId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, deletedAt: null },
    });
    if (!campaign) throw new NotFoundException("Campaign not found.");
    await this.workspaces.assertMembership(campaign.workspaceId, userId, CONTENT_MANAGE_ROLES);
    // Soft delete, and the Post.campaignId FK is onDelete: SetNull — so posts survive and simply
    // become uncategorised rather than disappearing with the campaign.
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { deletedAt: new Date() },
    });
  }

  async assignCampaign(postId: string, campaignId: string | null, userId: string): Promise<void> {
    const post = await this.prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException("Post not found.");
    await this.workspaces.assertMembership(post.workspaceId, userId, CONTENT_CREATE_ROLES);

    if (campaignId) {
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: campaignId, workspaceId: post.workspaceId, deletedAt: null },
      });
      if (!campaign) throw new NotFoundException("Campaign not found in this workspace.");
    }
    await this.prisma.post.update({ where: { id: postId }, data: { campaignId } });
  }

  /* --------------------------------- Templates ------------------------------- */

  async listTemplates(workspaceId: string, userId: string): Promise<TemplateDto[]> {
    await this.workspaces.assertMembership(workspaceId, userId, VIEW_ROLES);
    const templates = await this.prisma.postTemplate.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: [{ usageCount: "desc" }, { name: "asc" }],
    });
    return templates.map((t) => this.toTemplateDto(t));
  }

  async createTemplate(input: CreateTemplateInput, userId: string): Promise<TemplateDto> {
    await this.workspaces.assertMembership(input.workspaceId, userId, CONTENT_MANAGE_ROLES);
    try {
      const template = await this.prisma.postTemplate.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description ?? null,
          category: input.category ?? null,
          content: input.content,
          contentJson: input.contentJson === undefined ? Prisma.DbNull : (input.contentJson as Prisma.InputJsonValue),
          // Derived rather than client-supplied so the list can never disagree with the body.
          variables: extractTemplateVariables(input.content),
          defaultPlatforms: input.defaultPlatforms,
          createdById: userId,
        },
      });
      return this.toTemplateDto(template);
    } catch (err) {
      throw this.conflictOrRethrow(err, "A template with that name already exists.");
    }
  }

  async updateTemplate(
    templateId: string,
    input: UpdateTemplateInput,
    userId: string,
  ): Promise<TemplateDto> {
    const template = await this.prisma.postTemplate.findFirst({
      where: { id: templateId, deletedAt: null },
    });
    if (!template) throw new NotFoundException("Template not found.");
    await this.workspaces.assertMembership(template.workspaceId, userId, CONTENT_MANAGE_ROLES);

    // Wrapped for the same reason createTemplate is: PostTemplate carries
    // @@unique([workspaceId, name]), so renaming onto an existing name is a P2002 and would
    // otherwise reach the client as an opaque 500.
    try {
      const updated = await this.prisma.postTemplate.update({
        where: { id: templateId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.content !== undefined
          ? { content: input.content, variables: extractTemplateVariables(input.content) }
          : {}),
        ...(input.contentJson !== undefined
          ? {
              contentJson:
                input.contentJson === null ? Prisma.DbNull : (input.contentJson as Prisma.InputJsonValue),
            }
          : {}),
          ...(input.defaultPlatforms !== undefined
            ? { defaultPlatforms: input.defaultPlatforms }
            : {}),
        },
      });
      return this.toTemplateDto(updated);
    } catch (err) {
      throw this.conflictOrRethrow(err, "A template with that name already exists.");
    }
  }

  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    const template = await this.prisma.postTemplate.findFirst({
      where: { id: templateId, deletedAt: null },
    });
    if (!template) throw new NotFoundException("Template not found.");
    await this.workspaces.assertMembership(template.workspaceId, userId, CONTENT_MANAGE_ROLES);
    await this.prisma.postTemplate.update({
      where: { id: templateId },
      data: { deletedAt: new Date() },
    });
  }

  /** Substitutes the variables and returns a brand-new draft, attributed back to the template. */
  async instantiateTemplate(
    templateId: string,
    input: InstantiateTemplateInput,
    userId: string,
  ): Promise<string> {
    const template = await this.prisma.postTemplate.findFirst({
      where: { id: templateId, deletedAt: null },
    });
    if (!template) throw new NotFoundException("Template not found.");
    await this.workspaces.assertMembership(template.workspaceId, userId, CONTENT_CREATE_ROLES);

    if (input.socialAccountIds.length > 0) {
      const count = await this.prisma.socialAccount.count({
        where: { id: { in: input.socialAccountIds }, workspaceId: template.workspaceId },
      });
      if (count !== input.socialAccountIds.length) {
        throw new NotFoundException("One or more accounts are not in this workspace.");
      }
    }

    const [post] = await this.prisma.$transaction([
      this.prisma.post.create({
        data: {
          workspaceId: template.workspaceId,
          authorId: userId,
          updatedById: userId,
          title: template.name,
          content: applyTemplateVariables(template.content, input.variables),
          createdFromTemplateId: template.id,
          targets: {
            create: input.socialAccountIds.map((socialAccountId) => ({ socialAccountId })),
          },
        },
      }),
      this.prisma.postTemplate.update({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
      }),
    ]);

    return post.id;
  }

  /* --------------------------------- Snippets -------------------------------- */

  async listSnippets(workspaceId: string, userId: string): Promise<SnippetDto[]> {
    await this.workspaces.assertMembership(workspaceId, userId, VIEW_ROLES);
    const snippets = await this.prisma.snippet.findMany({
      where: { workspaceId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
    return snippets.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      body: s.body,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async createSnippet(input: CreateSnippetInput, userId: string): Promise<SnippetDto> {
    await this.workspaces.assertMembership(input.workspaceId, userId, CONTENT_CREATE_ROLES);
    try {
      const snippet = await this.prisma.snippet.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          kind: input.kind,
          body: input.body,
          createdById: userId,
        },
      });
      return {
        id: snippet.id,
        name: snippet.name,
        kind: snippet.kind,
        body: snippet.body,
        createdAt: snippet.createdAt.toISOString(),
      };
    } catch (err) {
      throw this.conflictOrRethrow(err, "A snippet with that name already exists.");
    }
  }

  async updateSnippet(
    snippetId: string,
    input: UpdateSnippetInput,
    userId: string,
  ): Promise<SnippetDto> {
    const snippet = await this.prisma.snippet.findUnique({ where: { id: snippetId } });
    if (!snippet) throw new NotFoundException("Snippet not found.");
    await this.workspaces.assertMembership(snippet.workspaceId, userId, CONTENT_MANAGE_ROLES);

    // Snippet carries @@unique([workspaceId, name]) too, so a rename collision is P2002.
    try {
      const updated = await this.prisma.snippet.update({ where: { id: snippetId }, data: input });
      return {
        id: updated.id,
        name: updated.name,
        kind: updated.kind,
        body: updated.body,
        createdAt: updated.createdAt.toISOString(),
      };
    } catch (err) {
      throw this.conflictOrRethrow(err, "A snippet with that name already exists.");
    }
  }

  async deleteSnippet(snippetId: string, userId: string): Promise<void> {
    const snippet = await this.prisma.snippet.findUnique({ where: { id: snippetId } });
    if (!snippet) throw new NotFoundException("Snippet not found.");
    await this.workspaces.assertMembership(snippet.workspaceId, userId, CONTENT_MANAGE_ROLES);
    await this.prisma.snippet.delete({ where: { id: snippetId } });
  }

  /* -------------------------------- Internals ------------------------------- */

  private async resolveWorkspace(entity: "post" | "media", entityId: string): Promise<string> {
    if (entity === "post") {
      const post = await this.prisma.post.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { workspaceId: true },
      });
      if (!post) throw new NotFoundException("Post not found.");
      return post.workspaceId;
    }
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: entityId, deletedAt: null },
      select: { workspaceId: true },
    });
    if (!asset) throw new NotFoundException("Media asset not found.");
    return asset.workspaceId;
  }

  private conflictOrRethrow(err: unknown, message: string): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new ConflictException(message);
    }
    return err;
  }

  private toCampaignDto(
    campaign: {
      id: string;
      name: string;
      description: string | null;
      color: string | null;
      goal: string | null;
      status: CampaignDto["status"];
      startsAt: Date | null;
      endsAt: Date | null;
      createdAt: Date;
    },
    postCount: number,
    publishedCount: number,
  ): CampaignDto {
    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      color: campaign.color,
      goal: campaign.goal,
      status: campaign.status,
      startsAt: campaign.startsAt?.toISOString() ?? null,
      endsAt: campaign.endsAt?.toISOString() ?? null,
      postCount,
      publishedCount,
      createdAt: campaign.createdAt.toISOString(),
    };
  }

  private toTemplateDto(template: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    content: string;
    contentJson: Prisma.JsonValue | null;
    variables: string[];
    defaultPlatforms: string[];
    usageCount: number;
    createdAt: Date;
  }): TemplateDto {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      content: template.content,
      contentJson: template.contentJson ?? null,
      variables: template.variables,
      defaultPlatforms: template.defaultPlatforms as SocialPlatform[],
      usageCount: template.usageCount,
      createdAt: template.createdAt.toISOString(),
    };
  }
}
