import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  bulkMediaSchema,
  createFolderSchema,
  finalizeUploadSchema,
  listMediaQuerySchema,
  presignUploadSchema,
  updateFolderSchema,
  updateMediaSchema,
  type BulkMediaInput,
  type CreateFolderInput,
  type FinalizeUploadInput,
  type ListMediaQuery,
  type PresignUploadInput,
  type UpdateFolderInput,
  type UpdateMediaInput,
} from "@social-platform/shared";
import { zodPipe } from "../../common/pipes/zod-validation.pipe";
import { MediaService } from "./media.service";

// Note: no @AllowAnonymous() here. The global AuthGuard applies, so every route below requires a
// session, and each service call additionally checks workspace membership.
@ApiTags("media")
@Controller({ path: "media", version: "1" })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /* --------------------------------- Folders -------------------------------- */
  // Declared before `:id` so "folders" isn't captured as an asset id.

  @Get("folders")
  @ApiOperation({ summary: "List the workspace's media folders as a flat, path-ordered tree" })
  listFolders(@Query("workspaceId") workspaceId: string, @Session() session: UserSession) {
    return this.mediaService.listFolders(workspaceId, session.user.id);
  }

  @Post("folders")
  createFolder(
    @Body(zodPipe(createFolderSchema)) body: CreateFolderInput,
    @Session() session: UserSession,
  ) {
    return this.mediaService.createFolder(body, session.user.id);
  }

  @Patch("folders/:id")
  updateFolder(
    @Param("id") id: string,
    @Body(zodPipe(updateFolderSchema)) body: UpdateFolderInput,
    @Session() session: UserSession,
  ) {
    return this.mediaService.updateFolder(id, body, session.user.id);
  }

  @Delete("folders/:id")
  @HttpCode(204)
  removeFolder(@Param("id") id: string, @Session() session: UserSession) {
    return this.mediaService.removeFolder(id, session.user.id);
  }

  /* --------------------------------- Uploads -------------------------------- */

  @Post("uploads/presign")
  @ApiOperation({
    summary: "Step 1 of 3: reserve an asset and return a presigned PUT",
    description:
      "The browser then PUTs the bytes directly to storage (step 2) and calls /media/:id/finalize " +
      "(step 3). Bytes never pass through this API.",
  })
  presign(
    @Body(zodPipe(presignUploadSchema)) body: PresignUploadInput,
    @Session() session: UserSession,
  ) {
    return this.mediaService.presignUpload(body, session.user.id);
  }

  @Post(":id/finalize")
  @ApiOperation({ summary: "Step 3 of 3: verify the object landed and queue processing" })
  finalize(
    @Param("id") id: string,
    @Body(zodPipe(finalizeUploadSchema)) body: FinalizeUploadInput,
    @Session() session: UserSession,
  ) {
    return this.mediaService.finalizeUpload(id, body, session.user.id);
  }

  /* ---------------------------------- Assets -------------------------------- */

  @Get()
  list(@Query(zodPipe(listMediaQuerySchema)) query: ListMediaQuery, @Session() session: UserSession) {
    return this.mediaService.list(query, session.user.id);
  }

  @Post("bulk")
  bulk(@Body(zodPipe(bulkMediaSchema)) body: BulkMediaInput, @Session() session: UserSession) {
    return this.mediaService.bulk(body, session.user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Session() session: UserSession) {
    return this.mediaService.findOne(id, session.user.id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(zodPipe(updateMediaSchema)) body: UpdateMediaInput,
    @Session() session: UserSession,
  ) {
    return this.mediaService.update(id, body, session.user.id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string, @Session() session: UserSession) {
    return this.mediaService.remove(id, session.user.id);
  }
}
