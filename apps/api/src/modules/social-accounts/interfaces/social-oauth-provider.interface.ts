import { SocialPlatform } from "@prisma/client";

/** URL param names the controller accepts — kept lowercase/URL-friendly, distinct from the
 *  Prisma SocialPlatform enum (which covers every platform, including ones not yet connectable). */
export type ConnectablePlatform = "facebook" | "tiktok";

export const CONNECTABLE_PLATFORMS: ConnectablePlatform[] = ["facebook", "tiktok"];

export interface ConnectedAccountResult {
  platform: SocialPlatform;
  externalAccountId: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  /** null/undefined means the token doesn't expire on a fixed schedule (e.g. Facebook Page tokens). */
  tokenExpiresAt?: Date | null;
  scopes: string[];
  metadata?: Record<string, unknown>;
}

export interface RefreshedTokenResult {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | null;
}

export interface OAuthAuthorizationRequest {
  state: string;
  codeChallenge?: string;
}

export interface OAuthCallbackRequest {
  code: string;
  codeVerifier?: string;
}

export interface SocialOAuthProvider {
  readonly platform: SocialPlatform;
  readonly connectablePlatform: ConnectablePlatform;
  /** Whether buildAuthorizationUrl needs a PKCE code_challenge (TikTok: yes, Facebook: no). */
  readonly usesPkce: boolean;

  buildAuthorizationUrl(request: OAuthAuthorizationRequest): string;

  /**
   * Exchanges the authorization code for one or more connected accounts. Returns an array
   * because a single Facebook grant can surface multiple Pages, and each Page may in turn
   * surface a linked Instagram Business account — all discovered in one callback.
   */
  handleCallback(request: OAuthCallbackRequest): Promise<ConnectedAccountResult[]>;

  /** Callers pass already-decrypted token material; providers never touch TokenCryptoService directly. */
  refreshToken(account: {
    externalAccountId: string;
    refreshToken: string | null;
    metadata: Record<string, unknown> | null;
  }): Promise<RefreshedTokenResult>;

  /** Best-effort revoke at the provider so a disconnect also invalidates the token upstream. */
  revoke(account: { accessToken: string }): Promise<void>;
}
