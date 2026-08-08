import { Body, Controller, Get, HttpCode, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { SchedulingService } from "./scheduling.service";

@ApiTags("scheduling")
@Controller({ path: "scheduling", version: "1" })
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get("calendar")
  @ApiOperation({ summary: "Scheduled posts in a date range, with per-target publish state" })
  calendar(
    @Query("workspaceId") workspaceId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("accountIds") accountIds: string | undefined,
    @Session() session: UserSession,
  ) {
    return this.scheduling.calendar(
      workspaceId,
      new Date(from),
      new Date(to),
      session.user.id,
      accountIds ? accountIds.split(",").filter(Boolean) : undefined,
    );
  }

  @Patch("posts/:id/schedule")
  @HttpCode(204)
  @ApiOperation({ summary: "Move a scheduled post (drag-to-reschedule)" })
  reschedule(
    @Param("id") id: string,
    @Body("scheduledAt") scheduledAt: string | null,
    @Session() session: UserSession,
  ) {
    return this.scheduling.reschedule(
      id,
      scheduledAt ? new Date(scheduledAt) : null,
      session.user.id,
    );
  }
}
