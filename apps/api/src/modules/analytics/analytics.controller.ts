import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { AnalyticsService } from "./analytics.service";

@ApiTags("analytics")
@Controller({ path: "analytics", version: "1" })
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("overview")
  @ApiOperation({
    summary: "Content volume and publish reliability for a workspace",
    description:
      "Derived from this platform's own publish record. Reach/impressions/engagement are not " +
      "included: they require polling each platform's insights API, which is not implemented.",
  })
  overview(
    @Query("workspaceId") workspaceId: string,
    @Query("days") days: string | undefined,
    @Session() session: UserSession,
  ) {
    const window = Math.min(Math.max(parseInt(days ?? "30", 10) || 30, 1), 365);
    return this.analytics.overview(workspaceId, session.user.id, window);
  }
}
