import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { zodPipe } from "../../common/pipes/zod-validation.pipe";
import { suggestCaptionsSchema, type SuggestCaptionsInput } from "@social-platform/shared";
import { AiService } from "./ai.service";

@ApiTags("ai")
@Controller({ path: "ai", version: "1" })
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get("status")
  @ApiOperation({ summary: "Whether AI assistance is usable, and why not if it is not" })
  status(@Session() session: UserSession) {
    return this.ai.isAvailable(session.user.id);
  }

  @Post("captions")
  suggest(
    @Body(zodPipe(suggestCaptionsSchema)) body: SuggestCaptionsInput,
    @Session() session: UserSession,
  ) {
    return this.ai.suggestCaptions(body, session.user.id);
  }
}
