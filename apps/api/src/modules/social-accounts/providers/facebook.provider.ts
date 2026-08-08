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

// Scopes needed to: list the Pages the user manages, publish to them, and read/publish to any
// Instagram Business account linked to those Pages.
const REQUIRED_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookPage {
  id: string;
  name: string;
  category?: string;
  access_token: string;
  tasks?: string[];
  instagram_business_account?: { id: string };
}

interface FacebookPagesResponse {
  data: FacebookPage[];
}

interface InstagramAccountDetails {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
}

interface FacebookGraphError {
  error?: { message: string; type: string; code: number };
}

/**
 * Meta does not offer Instagram as a standalone OAuth product for professional accounts — an
 * Instagram Business/Creator account is only reachable through the Facebook Page it's linked to,
 * using that Page's access token (see Meta's Instagram Graph API docs: "Instagram API with
 * Facebook Login"). So this single provider drives Facebook Login and, in the same callback,
 * discovers and returns every linked Instagram account too.
 */
@Injectable()
export class FacebookProvider implements SocialOAuthProvider {
  private readonly logger = new Logger(FacebookProvider.name);
  readonly platform = SocialPlatform.FACEBOOK;
  readonly connectablePlatform = "facebook" as const;
  readonly usesPkce = false;

  private readonly appId: string;
  private readonly appSecret: string;
  private readonly graphVersion: string;
  private readonly redirectUri: string;
  private readonly graphBase: string;

  constructor(private readonly config: ConfigService) {
    this.appId = this.config.get<string>("social.facebook.appId") ?? "";
    this.appSecret = this.config.get<string>("social.facebook.appSecret") ?? "";
    this.graphVersion = this.config.get<string>("social.facebook.graphVersion") ?? "v23.0";
    this.redirectUri = `${this.config.get<string>("apiUrl")}/api/v1/social-accounts/facebook/callback`;
    this.graphBase = `https://graph.facebook.com/${this.graphVersion}`;
  }

  buildAuthorizationUrl({ state }: OAuthAuthorizationRequest): string {
    const url = new URL(`https://www.facebook.com/${this.graphVersion}/dialog/oauth`);
    url.searchParams.set("client_id", this.appId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", REQUIRED_SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    return url.toString();
  }

  async handleCallback({ code }: OAuthCallbackRequest): Promise<ConnectedAccountResult[]> {
    const shortLivedToken = await this.exchangeCodeForToken(code);
    const longLivedUserToken = await this.exchangeForLongLivedToken(shortLivedToken);
    const pages = await this.fetchManagedPages(longLivedUserToken);

    const results: ConnectedAccountResult[] = [];

    for (const page of pages) {
      // Page access tokens derived from a long-lived user token do not expire on their own —
      // they're invalidated only if the user revokes access or changes their password.
      results.push({
        platform: SocialPlatform.FACEBOOK,
        externalAccountId: page.id,
        displayName: page.name,
        avatarUrl: `${this.graphBase}/${page.id}/picture?type=large`,
        accessToken: page.access_token,
        tokenExpiresAt: null,
        scopes: REQUIRED_SCOPES,
        metadata: { category: page.category ?? null, tasks: page.tasks ?? [] },
      });

      if (page.instagram_business_account?.id) {
        const igAccount = await this.fetchInstagramAccount(
          page.instagram_business_account.id,
          page.access_token,
        );
        if (igAccount) {
          results.push({
            platform: SocialPlatform.INSTAGRAM,
            externalAccountId: igAccount.id,
            displayName: igAccount.name || igAccount.username,
            handle: igAccount.username,
            avatarUrl: igAccount.profile_picture_url,
            // Instagram Graph API publishing calls use the linked Page's access token, not a
            // token of its own — store it here so the publish step (Phase 5) doesn't need to
            // re-derive it.
            accessToken: page.access_token,
            tokenExpiresAt: null,
            scopes: REQUIRED_SCOPES,
            metadata: { linkedFacebookPageId: page.id },
          });
        }
      }
    }

    return results;
  }

  async refreshToken(account: {
    externalAccountId: string;
    refreshToken: string | null;
    metadata: Record<string, unknown> | null;
  }): Promise<RefreshedTokenResult> {
    // Facebook Page tokens derived from a long-lived user token are effectively non-expiring
    // and have no refresh_token grant — "refreshing" just means re-validating that the token
    // still works. If it doesn't, the workspace admin has to reconnect (their long-lived user
    // token was itself revoked or expired after ~60 days of inactivity).
    void account;
    throw new BadGatewayException(
      "Facebook/Instagram connections don't auto-refresh — reconnect the account if it stops working.",
    );
  }

  async revoke({ accessToken }: { accessToken: string }): Promise<void> {
    const url = new URL(`${this.graphBase}/me/permissions`);
    url.searchParams.set("access_token", accessToken);
    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as FacebookGraphError;
      this.logger.warn(`Facebook revoke failed: ${body.error?.message ?? response.statusText}`);
      // Non-fatal — we still remove the local record even if the upstream revoke call fails.
    }
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const url = new URL(`${this.graphBase}/oauth/access_token`);
    url.searchParams.set("client_id", this.appId);
    url.searchParams.set("client_secret", this.appSecret);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("code", code);

    const response = await fetch(url);
    const body = (await response.json()) as FacebookTokenResponse & FacebookGraphError;
    if (!response.ok || !body.access_token) {
      throw new BadGatewayException(
        `Facebook token exchange failed: ${body.error?.message ?? "unknown error"}`,
      );
    }
    return body.access_token;
  }

  private async exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
    const url = new URL(`${this.graphBase}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", this.appId);
    url.searchParams.set("client_secret", this.appSecret);
    url.searchParams.set("fb_exchange_token", shortLivedToken);

    const response = await fetch(url);
    const body = (await response.json()) as FacebookTokenResponse & FacebookGraphError;
    if (!response.ok || !body.access_token) {
      throw new BadGatewayException(
        `Facebook long-lived token exchange failed: ${body.error?.message ?? "unknown error"}`,
      );
    }
    return body.access_token;
  }

  private async fetchManagedPages(userAccessToken: string): Promise<FacebookPage[]> {
    const url = new URL(`${this.graphBase}/me/accounts`);
    url.searchParams.set("access_token", userAccessToken);
    url.searchParams.set(
      "fields",
      "id,name,category,access_token,tasks,instagram_business_account",
    );
    url.searchParams.set("limit", "100");

    const response = await fetch(url);
    const body = (await response.json()) as FacebookPagesResponse & FacebookGraphError;
    if (!response.ok) {
      throw new BadGatewayException(
        `Fetching Facebook Pages failed: ${body.error?.message ?? "unknown error"}`,
      );
    }
    return body.data ?? [];
  }

  private async fetchInstagramAccount(
    igUserId: string,
    pageAccessToken: string,
  ): Promise<InstagramAccountDetails | null> {
    const url = new URL(`${this.graphBase}/${igUserId}`);
    url.searchParams.set("fields", "id,username,name,profile_picture_url");
    url.searchParams.set("access_token", pageAccessToken);

    const response = await fetch(url);
    const body = (await response.json()) as InstagramAccountDetails & FacebookGraphError;
    if (!response.ok) {
      this.logger.warn(`Instagram account lookup failed for ${igUserId}: ${body.error?.message}`);
      return null;
    }
    return body;
  }
}
