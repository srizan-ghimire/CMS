import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
  type UpdateWorkspaceInput,
} from "@social-platform/shared";
import { zodPipe } from "../../common/pipes/zod-validation.pipe";
import { WorkspacesService, type WorkspaceSummary } from "./workspaces.service";

@ApiTags("workspaces")
@Controller({ path: "workspaces", version: "1" })
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @ApiOperation({ summary: "List workspaces the current user owns or is a member of" })
  @Get("mine")
  mine(@Session() session: UserSession): Promise<WorkspaceSummary[]> {
    return this.workspacesService.listForUser(session.user.id);
  }

  @Post()
  create(
    @Body(zodPipe(createWorkspaceSchema)) body: CreateWorkspaceInput,
    @Session() session: UserSession,
  ) {
    return this.workspacesService.create(body, session.user.id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(zodPipe(updateWorkspaceSchema)) body: UpdateWorkspaceInput,
    @Session() session: UserSession,
  ) {
    return this.workspacesService.update(id, body, session.user.id);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Soft-delete a workspace (owner only)" })
  remove(@Param("id") id: string, @Session() session: UserSession) {
    return this.workspacesService.remove(id, session.user.id);
  }

  /* --------------------------------- Members -------------------------------- */

  @Get(":id/members")
  listMembers(@Param("id") id: string, @Session() session: UserSession) {
    return this.workspacesService.listMembers(id, session.user.id);
  }

  @Patch(":id/members/:userId")
  @HttpCode(204)
  updateMemberRole(
    @Param("id") id: string,
    @Param("userId") memberUserId: string,
    @Body(zodPipe(updateMemberRoleSchema)) body: UpdateMemberRoleInput,
    @Session() session: UserSession,
  ) {
    return this.workspacesService.updateMemberRole(id, memberUserId, body, session.user.id);
  }

  @Delete(":id/members/:userId")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove a member, or leave the workspace yourself" })
  removeMember(
    @Param("id") id: string,
    @Param("userId") memberUserId: string,
    @Session() session: UserSession,
  ) {
    return this.workspacesService.removeMember(id, memberUserId, session.user.id);
  }

  /* ------------------------------- Invitations ------------------------------- */

  @Get(":id/invitations")
  listInvitations(@Param("id") id: string, @Session() session: UserSession) {
    return this.workspacesService.listInvitations(id, session.user.id);
  }

  @Post(":id/invitations")
  invite(
    @Param("id") id: string,
    @Body(zodPipe(inviteMemberSchema)) body: InviteMemberInput,
    @Session() session: UserSession,
  ) {
    return this.workspacesService.invite(id, body, session.user.id);
  }

  @Delete("invitations/:invitationId")
  @HttpCode(204)
  revokeInvitation(
    @Param("invitationId") invitationId: string,
    @Session() session: UserSession,
  ) {
    return this.workspacesService.revokeInvitation(invitationId, session.user.id);
  }

  @Post("invitations/:token/accept")
  @ApiOperation({
    summary: "Accept an invitation",
    description:
      "Requires a signed-in user whose email matches the invited address — the token alone is " +
      "not sufficient, so a forwarded link cannot be redeemed by someone else.",
  })
  accept(@Param("token") token: string, @Session() session: UserSession) {
    return this.workspacesService.acceptInvitation(token, session.user.id);
  }
}
