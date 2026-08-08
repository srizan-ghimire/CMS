import { Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller({ path: "notifications", version: "1" })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "The signed-in user's notifications, newest first, with unread count" })
  list(@Query("unreadOnly") unreadOnly: string | undefined, @Session() session: UserSession) {
    return this.notifications.list(session.user.id, unreadOnly === "true");
  }

  @Post(":id/read")
  @HttpCode(204)
  markRead(@Param("id") id: string, @Session() session: UserSession) {
    return this.notifications.markRead(id, session.user.id);
  }

  @Post("read-all")
  markAllRead(@Session() session: UserSession) {
    return this.notifications.markAllRead(session.user.id);
  }
}
