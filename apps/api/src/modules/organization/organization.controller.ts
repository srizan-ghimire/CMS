import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  createCampaignSchema,
  createSnippetSchema,
  createTagSchema,
  createTemplateSchema,
  instantiateTemplateSchema,
  setTagsSchema,
  updateCampaignSchema,
  updateSnippetSchema,
  updateTagSchema,
  updateTemplateSchema,
  type CreateCampaignInput,
  type CreateSnippetInput,
  type CreateTagInput,
  type CreateTemplateInput,
  type InstantiateTemplateInput,
  type SetTagsInput,
  type UpdateCampaignInput,
  type UpdateSnippetInput,
  type UpdateTagInput,
  type UpdateTemplateInput,
} from "@social-platform/shared";
import { zodPipe } from "../../common/pipes/zod-validation.pipe";
import { OrganizationService } from "./organization.service";

@ApiTags("organization")
@Controller({ version: "1" })
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  /* ----------------------------------- Tags --------------------------------- */

  @Get("tags")
  listTags(@Query("workspaceId") workspaceId: string, @Session() session: UserSession) {
    return this.organization.listTags(workspaceId, session.user.id);
  }

  @Post("tags")
  createTag(@Body(zodPipe(createTagSchema)) body: CreateTagInput, @Session() session: UserSession) {
    return this.organization.createTag(body, session.user.id);
  }

  @Patch("tags/:id")
  updateTag(
    @Param("id") id: string,
    @Body(zodPipe(updateTagSchema)) body: UpdateTagInput,
    @Session() session: UserSession,
  ) {
    return this.organization.updateTag(id, body, session.user.id);
  }

  @Delete("tags/:id")
  @HttpCode(204)
  deleteTag(@Param("id") id: string, @Session() session: UserSession) {
    return this.organization.deleteTag(id, session.user.id);
  }

  @Post("posts/:id/tags")
  @ApiOperation({ summary: "Replace the full tag set on a post" })
  setPostTags(
    @Param("id") id: string,
    @Body(zodPipe(setTagsSchema)) body: SetTagsInput,
    @Session() session: UserSession,
  ) {
    return this.organization.setTags("post", id, body.tagIds, session.user.id);
  }

  @Post("media/:id/tags")
  @ApiOperation({ summary: "Replace the full tag set on a media asset" })
  setMediaTags(
    @Param("id") id: string,
    @Body(zodPipe(setTagsSchema)) body: SetTagsInput,
    @Session() session: UserSession,
  ) {
    return this.organization.setTags("media", id, body.tagIds, session.user.id);
  }

  /* --------------------------------- Campaigns ------------------------------- */

  @Get("campaigns")
  listCampaigns(@Query("workspaceId") workspaceId: string, @Session() session: UserSession) {
    return this.organization.listCampaigns(workspaceId, session.user.id);
  }

  @Post("campaigns")
  createCampaign(
    @Body(zodPipe(createCampaignSchema)) body: CreateCampaignInput,
    @Session() session: UserSession,
  ) {
    return this.organization.createCampaign(body, session.user.id);
  }

  @Patch("campaigns/:id")
  updateCampaign(
    @Param("id") id: string,
    @Body(zodPipe(updateCampaignSchema)) body: UpdateCampaignInput,
    @Session() session: UserSession,
  ) {
    return this.organization.updateCampaign(id, body, session.user.id);
  }

  @Delete("campaigns/:id")
  @HttpCode(204)
  deleteCampaign(@Param("id") id: string, @Session() session: UserSession) {
    return this.organization.deleteCampaign(id, session.user.id);
  }

  @Post("posts/:id/campaign")
  assignCampaign(
    @Param("id") id: string,
    @Body("campaignId") campaignId: string | null,
    @Session() session: UserSession,
  ) {
    return this.organization.assignCampaign(id, campaignId ?? null, session.user.id);
  }

  /* --------------------------------- Templates ------------------------------- */

  @Get("templates")
  listTemplates(@Query("workspaceId") workspaceId: string, @Session() session: UserSession) {
    return this.organization.listTemplates(workspaceId, session.user.id);
  }

  @Post("templates")
  createTemplate(
    @Body(zodPipe(createTemplateSchema)) body: CreateTemplateInput,
    @Session() session: UserSession,
  ) {
    return this.organization.createTemplate(body, session.user.id);
  }

  @Patch("templates/:id")
  updateTemplate(
    @Param("id") id: string,
    @Body(zodPipe(updateTemplateSchema)) body: UpdateTemplateInput,
    @Session() session: UserSession,
  ) {
    return this.organization.updateTemplate(id, body, session.user.id);
  }

  @Delete("templates/:id")
  @HttpCode(204)
  deleteTemplate(@Param("id") id: string, @Session() session: UserSession) {
    return this.organization.deleteTemplate(id, session.user.id);
  }

  @Post("templates/:id/instantiate")
  @ApiOperation({ summary: "Create a draft post from a template, substituting {{variables}}" })
  async instantiate(
    @Param("id") id: string,
    @Body(zodPipe(instantiateTemplateSchema)) body: InstantiateTemplateInput,
    @Session() session: UserSession,
  ) {
    const postId = await this.organization.instantiateTemplate(id, body, session.user.id);
    return { postId };
  }

  /* --------------------------------- Snippets -------------------------------- */

  @Get("snippets")
  listSnippets(@Query("workspaceId") workspaceId: string, @Session() session: UserSession) {
    return this.organization.listSnippets(workspaceId, session.user.id);
  }

  @Post("snippets")
  createSnippet(
    @Body(zodPipe(createSnippetSchema)) body: CreateSnippetInput,
    @Session() session: UserSession,
  ) {
    return this.organization.createSnippet(body, session.user.id);
  }

  @Patch("snippets/:id")
  updateSnippet(
    @Param("id") id: string,
    @Body(zodPipe(updateSnippetSchema)) body: UpdateSnippetInput,
    @Session() session: UserSession,
  ) {
    return this.organization.updateSnippet(id, body, session.user.id);
  }

  @Delete("snippets/:id")
  @HttpCode(204)
  deleteSnippet(@Param("id") id: string, @Session() session: UserSession) {
    return this.organization.deleteSnippet(id, session.user.id);
  }
}
