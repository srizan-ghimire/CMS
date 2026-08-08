import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  createCommentSchema,
  decideApprovalSchema,
  requestApprovalSchema,
  restoreVersionSchema,
  updateApprovalPolicySchema,
  type CreateCommentInput,
  type DecideApprovalInput,
  type RequestApprovalInput,
  type RestoreVersionInput,
  type UpdateApprovalPolicyInput,
} from "@social-platform/shared";
import { zodPipe } from "../../common/pipes/zod-validation.pipe";
import { ApprovalsService } from "./approvals.service";

@ApiTags("approvals")
@Controller({ version: "1" })
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  /* -------------------------------- Versions -------------------------------- */

  @Get("posts/:id/versions")
  listVersions(@Param("id") id: string, @Session() session: UserSession) {
    return this.approvals.listVersions(id, session.user.id);
  }

  @Post("posts/:id/versions/restore")
  @ApiOperation({
    summary: "Restore an earlier version",
    description:
      "Writes a NEW version from the old snapshot rather than rewriting history, so the restore " +
      "is itself undoable.",
  })
  @HttpCode(204)
  restore(
    @Param("id") id: string,
    @Body(zodPipe(restoreVersionSchema)) body: RestoreVersionInput,
    @Session() session: UserSession,
  ) {
    return this.approvals.restoreVersion(id, body.versionNumber, session.user.id);
  }

  /* -------------------------------- Approvals ------------------------------- */

  @Get("approvals/queue")
  myQueue(@Session() session: UserSession) {
    return this.approvals.myQueue(session.user.id);
  }

  @Get("approvals/policy")
  getPolicy(@Query("workspaceId") workspaceId: string, @Session() session: UserSession) {
    return this.approvals.getPolicy(workspaceId, session.user.id);
  }

  @Patch("approvals/policy")
  updatePolicy(
    @Query("workspaceId") workspaceId: string,
    @Body(zodPipe(updateApprovalPolicySchema)) body: UpdateApprovalPolicyInput,
    @Session() session: UserSession,
  ) {
    return this.approvals.updatePolicy(workspaceId, body, session.user.id);
  }

  @Get("posts/:id/approvals")
  listApprovals(@Param("id") id: string, @Session() session: UserSession) {
    return this.approvals.listApprovals(id, session.user.id);
  }

  @Post("posts/:id/request-approval")
  requestApproval(
    @Param("id") id: string,
    @Body(zodPipe(requestApprovalSchema)) body: RequestApprovalInput,
    @Session() session: UserSession,
  ) {
    return this.approvals.requestApproval(id, body, session.user.id);
  }

  @Post("approvals/:approvalId/decide")
  decide(
    @Param("approvalId") approvalId: string,
    @Body(zodPipe(decideApprovalSchema)) body: DecideApprovalInput,
    @Session() session: UserSession,
  ) {
    return this.approvals.decide(approvalId, body, session.user.id);
  }

  /* --------------------------------- Comments -------------------------------- */

  @Get("posts/:id/comments")
  listComments(@Param("id") id: string, @Session() session: UserSession) {
    return this.approvals.listComments(id, session.user.id);
  }

  @Post("posts/:id/comments")
  addComment(
    @Param("id") id: string,
    @Body(zodPipe(createCommentSchema)) body: CreateCommentInput,
    @Session() session: UserSession,
  ) {
    return this.approvals.addComment(id, body, session.user.id);
  }

  @Post("comments/:commentId/resolve")
  @HttpCode(204)
  resolve(@Param("commentId") commentId: string, @Session() session: UserSession) {
    return this.approvals.resolveComment(commentId, true, session.user.id);
  }

  @Post("comments/:commentId/unresolve")
  @HttpCode(204)
  unresolve(@Param("commentId") commentId: string, @Session() session: UserSession) {
    return this.approvals.resolveComment(commentId, false, session.user.id);
  }

  @Delete("comments/:commentId")
  @HttpCode(204)
  deleteComment(@Param("commentId") commentId: string, @Session() session: UserSession) {
    return this.approvals.deleteComment(commentId, session.user.id);
  }
}
