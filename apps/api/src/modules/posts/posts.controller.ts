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
  createPostSchema,
  listPostsQuerySchema,
  updatePostSchema,
  type CreatePostInput,
  type ListPostsQuery,
  type UpdatePostInput,
} from "@social-platform/shared";
import { zodPipe } from "../../common/pipes/zod-validation.pipe";
import { PostsService } from "./posts.service";

@ApiTags("posts")
@Controller({ path: "posts", version: "1" })
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  list(
    @Query(zodPipe(listPostsQuerySchema)) query: ListPostsQuery,
    @Session() session: UserSession,
  ) {
    return this.postsService.findMany(query, session.user.id);
  }

  @Post()
  create(@Body(zodPipe(createPostSchema)) body: CreatePostInput, @Session() session: UserSession) {
    return this.postsService.create(body, session.user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Session() session: UserSession) {
    return this.postsService.findOne(id, session.user.id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update a draft",
    description:
      "`mediaAssetIds` and `targets` are full replacements when present. Targets are diffed " +
      "rather than recreated, so an already-published target keeps its publish record.",
  })
  update(
    @Param("id") id: string,
    @Body(zodPipe(updatePostSchema)) body: UpdatePostInput,
    @Session() session: UserSession,
  ) {
    return this.postsService.update(id, body, session.user.id);
  }

  @Get(":id/validate")
  @ApiOperation({
    summary: "Per-target platform validation",
    description:
      "Runs the same PLATFORM_LIMITS rules the publish pipeline uses, so violations surface in " +
      "the composer instead of as a failed queue job.",
  })
  validate(@Param("id") id: string, @Session() session: UserSession) {
    return this.postsService.validate(id, session.user.id);
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string, @Session() session: UserSession) {
    return this.postsService.duplicate(id, session.user.id);
  }

  @Post(":id/archive")
  archive(@Param("id") id: string, @Session() session: UserSession) {
    return this.postsService.setArchived(id, true, session.user.id);
  }

  @Post(":id/unarchive")
  unarchive(@Param("id") id: string, @Session() session: UserSession) {
    return this.postsService.setArchived(id, false, session.user.id);
  }

  @Post(":id/restore")
  restore(@Param("id") id: string, @Session() session: UserSession) {
    return this.postsService.restore(id, session.user.id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string, @Session() session: UserSession) {
    return this.postsService.remove(id, session.user.id);
  }
}
