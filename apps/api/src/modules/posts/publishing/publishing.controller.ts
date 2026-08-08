import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session as AuthSession, type UserSession } from "@thallesp/nestjs-better-auth";
import { PublishingService } from "./publishing.service";

@ApiTags("publishing")
@Controller({ path: "posts", version: "1" })
export class PublishingController {
  constructor(private readonly publishing: PublishingService) {}

  @Post(":id/publish")
  @ApiOperation({
    summary: "Publish now, or enqueue for the post's scheduled time",
    description:
      "Targets that fail platform validation are marked SKIPPED without consuming a retry, so a " +
      "post can still go out everywhere else.",
  })
  publish(
    @Param("id") id: string,
    @Body("publishNow") publishNow: boolean | undefined,
    @AuthSession() session: UserSession,
  ) {
    return this.publishing.enqueue(id, session.user.id, { publishNow: publishNow ?? true });
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string, @AuthSession() session: UserSession) {
    return this.publishing.cancel(id, session.user.id);
  }

  @Post("targets/:targetId/retry")
  @ApiOperation({
    summary: "Retry one failed target",
    description:
      "Bumps publishRound so BullMQ sees a brand-new job. Any saved containerId is preserved, so " +
      "a partially-created platform post resumes rather than duplicating.",
  })
  retry(@Param("targetId") targetId: string, @AuthSession() session: UserSession) {
    return this.publishing.retryTarget(targetId, session.user.id);
  }
}
