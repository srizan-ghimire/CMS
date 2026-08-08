import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller({ path: "users", version: "1" })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Protected by the global AuthGuard registered in AppModule — no session, no access.
  @Get("me")
  me(@Session() session: UserSession) {
    return this.usersService.toPublicProfile(session.user);
  }
}
