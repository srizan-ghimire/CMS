import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SocialPlatform } from "@prisma/client";
import {
  ConnectedAccountResult,
  OAuthAuthorizationRequest,
  OAuthCallbackRequest,
  RefreshedTokenResult,
  SocialOAuthProvider,
} from "../interfaces/social-oauth-provider.interface";

// video.publish covers the Content Posting API (Phase 5); user.info.basic/profile give us the
// display name + avatar shown in the connections UI.
const REQUIRED_SCOPES = ["user.info.basic", "user.info.profile", "video.publish"];

interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface TikTokUserInfoResponse {
  data?: {
    user?: {
      open_id: string;
      display_name: string;
      avatar_url: string;
    };
  };
  error?: { code: string; message: string };
}

@Injectable()
export class TikTokProvider implements SocialOAuthProvider {
  private readonly logger = new Logger(TikTokProvider.name);
  readonly platform = SocialPlatform.TIKTOK;
  readonly connectablePlatform = "tiktok" as const;
  readonly usesPkce = true;

  private readonly clientKey: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly config: ConfigService) {
    this.clientKey = this.config.get<string>("social.tiktok.clientKey") ?? "";
    this.clientSecret = this.config.get<string>("social.tiktok.clientSecret") ?? "";
    this.redirectUri = `${this.config.get<string>("apiUrl")}/api/v1/social-accounts/tiktok/callback`;
  }

  buildAuthorizationUrl({ state, codeChallenge }: OAuthAuthorizationRequest): string {
    if (!codeChallenge) {
      throw new Error("TikTok authorization requires a PKCE code_challenge");
    }
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", this.clientKey);
    url.searchParams.set("scope", REQUIRED_SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async handleCallback({ code, codeVerifier }: OAuthCallbackRequest): Promise<ConnectedAccountResult[]> {
    if (!codeVerifier) {
      throw new BadGatewayException("Missing PKCE code_verifier for TikTok token exchange.");
    }

    const token = await this.postToken({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });

    const profile = await this.fetchUserInfo(token.access_token);

    return [
      {
        platform: SocialPlatform.TIKTOK,
        externalAccountId: token.open_id,
        displayName: profile?.display_name ?? token.open_id,
        handle: profile?.display_name,
        avatarUrl: profile?.avatar_url,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
        scopes: token.scope.split(","),
        metadata: { refreshTokenExpiresAt: new Date(Date.now() + token.refresh_expires_in * 1000) },
      },
    ];
  }

  async refreshToken(account: {
    externalAccountId: string;
    refreshToken: string | null;
  }): Promise<RefreshedTokenResult> {
    if (!account.refreshToken) {
      throw new BadGatewayException("No refresh token on file for this TikTok account.");
    }

    const token = await this.postToken({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    });

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    };
  }

  async revoke({ accessToken }: { accessToken: string }): Promise<void> {
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        token: accessToken,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`TikTok revoke failed (${response.status}): ${body}`);
    }
  }

  private async postToken(params: Record<string, string>): Promise<TikTokTokenResponse> {
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams(params),
    });
    const body = (await response.json()) as TikTokTokenResponse;
    if (!response.ok || body.error || !body.access_token) {
      throw new BadGatewayException(
        `TikTok token request failed: ${body.error_description ?? body.error ?? "unknown error"}`,
      );
    }
    return body;
  }

  private async fetchUserInfo(
    accessToken: string,
  ): Promise<{ open_id: string; display_name: string; avatar_url: string } | null> {
    const url = new URL("https://open.tiktokapis.com/v2/user/info/");
    url.searchParams.set("fields", "open_id,display_name,avatar_url");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = (await response.json()) as TikTokUserInfoResponse;
    if (!response.ok || body.error) {
      this.logger.warn(`TikTok user info lookup failed: ${body.error?.message}`);
      return null;
    }
    return body.data?.user ?? null;
  }
}
