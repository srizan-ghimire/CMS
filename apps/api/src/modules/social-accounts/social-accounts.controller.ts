import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { ConfigService } from "@nestjs/config";
import { SocialAccountsService } from "./social-accounts.service";
import { ConnectQueryDto } from "./dto/connect-query.dto";
import { CallbackQueryDto } from "./dto/callback-query.dto";
import { AuthorizationUrlResponseDto, SocialAccountResponseDto } from "./dto/social-account-response.dto";
import { ConnectablePlatform } from "./interfaces/social-oauth-provider.interface";

// A minimal local enum for ParseEnumPipe — the interface file exports a union type, which
// ParseEnumPipe can't introspect at runtime, so the actual string values are mirrored here.
enum ConnectablePlatformParam {
  facebook = "facebook",
  tiktok = "tiktok",
}

@ApiTags("social-accounts")
@Controller({ path: "social-accounts", version: "1" })
export class SocialAccountsController {
  constructor(
    private readonly socialAccountsService: SocialAccountsService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({ summary: "List every social account connected to a workspace" })
  @Get("workspaces/:workspaceId")
  list(
    @Param("workspaceId") workspaceId: string,
    @Session() session: UserSession,
  ): Promise<SocialAccountResponseDto[]> {
    return this.socialAccountsService.list(workspaceId, session.user.id);
  }

  @ApiOperation({ summary: "Get the URL to send the browser to for a Facebook/TikTok connection" })
  @Get(":platform/connect")
  async connect(
    @Param("platform", new ParseEnumPipe(ConnectablePlatformParam)) platform: ConnectablePlatform,
    @Query() query: ConnectQueryDto,
    @Session() session: UserSession,
  ): Promise<AuthorizationUrlResponseDto> {
    const url = await this.socialAccountsService.getAuthorizationUrl(
      platform,
      query.workspaceId,
      session.user.id,
      query.redirectPath,
    );
    return { url };
  }

  // Facebook/TikTok redirect the user's browser here directly after they approve or deny access
  // — there's no Authorization header on this request, so it must be reachable without a
  // session. Everything sensitive is recovered from the single-use OAuthState row (see
  // OAuthStateService), keyed off the opaque `state` param, not from anything else on the request.
  @ApiExcludeEndpoint()
  @AllowAnonymous()
  @Get(":platform/callback")
  async callback(
    @Param("platform", new ParseEnumPipe(ConnectablePlatformParam)) platform: ConnectablePlatform,
    @Query() query: CallbackQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const webUrl = this.config.get<string>("webUrl") ?? "http://localhost:3000";
    try {
      const result = await this.socialAccountsService.handleCallback(platform, query);
      const redirectUrl = new URL(result.redirectPath, webUrl);
      redirectUrl.searchParams.set("connected", result.platform);
      redirectUrl.searchParams.set("count", String(result.connectedCount));
      res.redirect(redirectUrl.toString());
    } catch {
      const redirectUrl = new URL("/settings/connections", webUrl);
      redirectUrl.searchParams.set("error", "connection_failed");
      res.redirect(redirectUrl.toString());
    }
  }

  @ApiOperation({ summary: "Disconnect a social account (revokes upstream on a best-effort basis)" })
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@Param("id") id: string, @Session() session: UserSession): Promise<void> {
    await this.socialAccountsService.disconnect(id, session.user.id);
  }

  @ApiOperation({ summary: "Force an immediate token refresh for a connected account" })
  @Post(":id/refresh")
  refresh(
    @Param("id") id: string,
    @Session() session: UserSession,
  ): Promise<SocialAccountResponseDto> {
    return this.socialAccountsService.triggerManualRefresh(id, session.user.id);
  }
}
