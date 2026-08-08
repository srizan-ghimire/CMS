import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@Controller({ path: "admin", version: "1" })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("audit-log")
  @ApiOperation({ summary: "Audit trail for one workspace (OWNER/ADMIN only)" })
  auditLog(
    @Query("workspaceId") workspaceId: string,
    @Query("cursor") cursor: string | undefined,
    @Session() session: UserSession,
  ) {
    return this.admin.auditLog(workspaceId, session.user.id, 100, cursor);
  }

  @Get("feature-flags")
  listFlags() {
    return this.admin.listFlags();
  }

  @Patch("feature-flags/:key")
  setFlag(
    @Param("key") key: string,
    @Body() body: { enabled?: boolean; rolloutPercentage?: number },
    @Session() session: UserSession,
  ) {
    return this.admin.setFlag(key, body, session.user.id);
  }

  @Get("plans")
  listPlans() {
    return this.admin.listPlans();
  }

  @Get("queues")
  @ApiOperation({ summary: "Depth of the publish and media queues" })
  queues(@Session() session: UserSession) {
    return this.admin.queueStats(session.user.id);
  }
}
