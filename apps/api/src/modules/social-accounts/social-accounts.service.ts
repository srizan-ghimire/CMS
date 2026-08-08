import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  SocialAccount} from "@prisma/client";
import {
  NotificationType,
  SocialAccountStatus,
  WorkspaceRole,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { MANAGE_CONNECTIONS_ROLES } from "../workspaces/lib/roles";
import { TokenCryptoService } from "./lib/token-crypto.service";
import { deriveTikTokCodeChallenge, generateCodeVerifier } from "./lib/pkce.util";
import { OAuthStateService } from "./oauth-state.service";
import { SocialOAuthProviderRegistry } from "./providers/provider.registry";
import { SOCIAL_OAUTH_PROVIDERS } from "./providers/provider.registry";
import { ConnectablePlatform } from "./interfaces/social-oauth-provider.interface";
import { CONNECTABLE_PLATFORMS } from "./interfaces/social-oauth-provider.interface";
import { SocialAccountResponseDto } from "./dto/social-account-response.dto";

export interface CallbackResult {
  redirectPath: string;
  connectedCount: number;
  platform: ConnectablePlatform;
}

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
    private readonly oauthState: OAuthStateService,
    private readonly workspaces: WorkspacesService,
    @Inject(SOCIAL_OAUTH_PROVIDERS) private readonly providers: SocialOAuthProviderRegistry,
  ) {}

  private provider(platform: ConnectablePlatform) {
    if (!CONNECTABLE_PLATFORMS.includes(platform)) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return this.providers[platform];
  }

  private assertMembership(
    workspaceId: string,
    userId: string,
    allowedRoles?: WorkspaceRole[],
  ): Promise<WorkspaceRole> {
    return this.workspaces.assertMembership(workspaceId, userId, allowedRoles);
  }

  async list(workspaceId: string, userId: string): Promise<SocialAccountResponseDto[]> {
    await this.assertMembership(workspaceId, userId);
    const accounts = await this.prisma.socialAccount.findMany({
      where: { workspaceId },
      orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
    });
    return accounts.map((a) => this.toResponseDto(a));
  }

  async getAuthorizationUrl(
    platform: ConnectablePlatform,
    workspaceId: string,
    userId: string,
    redirectPath?: string,
  ): Promise<string> {
    await this.assertMembership(workspaceId, userId, MANAGE_CONNECTIONS_ROLES);
    const provider = this.provider(platform);

    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;
    if (provider.usesPkce) {
      codeVerifier = generateCodeVerifier();
      codeChallenge = deriveTikTokCodeChallenge(codeVerifier);
    }

    const state = await this.oauthState.create({
      platform: provider.platform,
      workspaceId,
      userId,
      codeVerifier,
      redirectPath,
    });

    return provider.buildAuthorizationUrl({ state, codeChallenge });
  }

  /**
   * Runs unauthenticated (this is where Facebook/TikTok redirect the browser back to) — every
   * bit of context (which user, which workspace) is recovered from the single-use OAuthState
   * row rather than trusted from the request. Returns where the frontend should be redirected to,
   * rather than throwing, so the controller can always send the user somewhere sensible even on
   * failure.
   */
  async handleCallback(
    platform: ConnectablePlatform,
    query: { code?: string; state: string; error?: string; error_description?: string },
  ): Promise<CallbackResult> {
    const provider = this.provider(platform);
    const stateRow = await this.oauthState.consume(query.state, provider.platform);

    if (query.error || !query.code) {
      this.logger.warn(
        `${platform} OAuth denied/failed for workspace ${stateRow.workspaceId}: ${query.error ?? "no code returned"} ${query.error_description ?? ""}`,
      );
      return { redirectPath: stateRow.redirectPath, connectedCount: 0, platform };
    }

    const connected = await provider.handleCallback({
      code: query.code,
      codeVerifier: stateRow.codeVerifier ?? undefined,
    });

    for (const account of connected) {
      // Prisma's InputJsonValue doesn't accept a bare Record<string, unknown> (unknown could hold a
      // non-JSON value), but ConnectedAccountResult.metadata is always plain JSON built by the
      // providers — so narrow it once here rather than at both the create and update branches.
      const metadata = (account.metadata ?? undefined) as Prisma.InputJsonValue | undefined;

      await this.prisma.socialAccount.upsert({
        where: {
          workspaceId_platform_externalAccountId: {
            workspaceId: stateRow.workspaceId,
            platform: account.platform,
            externalAccountId: account.externalAccountId,
          },
        },
        create: {
          workspaceId: stateRow.workspaceId,
          platform: account.platform,
          externalAccountId: account.externalAccountId,
          displayName: account.displayName,
          handle: account.handle,
          avatarUrl: account.avatarUrl,
          status: SocialAccountStatus.CONNECTED,
          encryptedAccessToken: this.tokenCrypto.encrypt(account.accessToken),
          encryptedRefreshToken: account.refreshToken
            ? this.tokenCrypto.encrypt(account.refreshToken)
            : null,
          tokenExpiresAt: account.tokenExpiresAt ?? null,
          scopes: account.scopes,
          metadata,
          connectedById: stateRow.userId,
          lastValidatedAt: new Date(),
        },
        update: {
          displayName: account.displayName,
          handle: account.handle,
          avatarUrl: account.avatarUrl,
          status: SocialAccountStatus.CONNECTED,
          encryptedAccessToken: this.tokenCrypto.encrypt(account.accessToken),
          encryptedRefreshToken: account.refreshToken
            ? this.tokenCrypto.encrypt(account.refreshToken)
            : null,
          tokenExpiresAt: account.tokenExpiresAt ?? null,
          scopes: account.scopes,
          metadata,
          connectedById: stateRow.userId,
          lastValidatedAt: new Date(),
          lastErrorMessage: null,
        },
      });
    }

    return { redirectPath: stateRow.redirectPath, connectedCount: connected.length, platform };
  }

  async disconnect(accountId: string, userId: string): Promise<void> {
    const account = await this.prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException("Social account not found.");
    }
    await this.assertMembership(account.workspaceId, userId, MANAGE_CONNECTIONS_ROLES);

    const connectablePlatform = this.connectablePlatformFor(account);
    if (connectablePlatform && account.encryptedAccessToken) {
      try {
        const accessToken = this.tokenCrypto.decrypt(account.encryptedAccessToken);
        await this.providers[connectablePlatform].revoke({ accessToken });
      } catch (err) {
        // Upstream revoke is best-effort — we still disconnect locally even if it fails (token
        // already invalid, provider outage, etc). Log so it's visible in monitoring.
        this.logger.warn(`Provider-side revoke failed for account ${accountId}: ${String(err)}`);
      }
    }

    // Soft-disconnect rather than delete: PostTarget rows (Phase 5+) may still reference this
    // account for publish history, and re-connecting the same external account should resume
    // using the same row (see the upsert in handleCallback) rather than creating a duplicate.
    await this.prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        status: SocialAccountStatus.REVOKED,
        encryptedAccessToken: "",
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
      },
    });
  }

  async triggerManualRefresh(accountId: string, userId: string): Promise<SocialAccountResponseDto> {
    const account = await this.prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException("Social account not found.");
    }
    await this.assertMembership(account.workspaceId, userId, MANAGE_CONNECTIONS_ROLES);

    const updated = await this.refreshAccount(account);
    return this.toResponseDto(updated);
  }

  /** Shared by the manual-refresh endpoint and the scheduled BullMQ processor. */
  async refreshAccount(account: SocialAccount): Promise<SocialAccount> {
    const connectablePlatform = this.connectablePlatformFor(account);
    if (!connectablePlatform) {
      return account;
    }

    // Facebook Page / Instagram tokens derived from a long-lived user token don't expire on a
    // schedule and have no refresh_token grant (see FacebookProvider.refreshToken) — there's
    // nothing to refresh, and calling the provider would just throw. tokenExpiresAt === null is
    // how those accounts are marked at connect-time, so treat it as "not applicable" rather than
    // attempting a refresh that can only ever fail.
    if (account.tokenExpiresAt === null) {
      return account;
    }

    try {
      const refreshTokenPlaintext = account.encryptedRefreshToken
        ? this.tokenCrypto.decrypt(account.encryptedRefreshToken)
        : null;

      const result = await this.providers[connectablePlatform].refreshToken({
        externalAccountId: account.externalAccountId,
        refreshToken: refreshTokenPlaintext,
        metadata: (account.metadata as Record<string, unknown> | null) ?? null,
      });

      return await this.prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          status: SocialAccountStatus.CONNECTED,
          encryptedAccessToken: this.tokenCrypto.encrypt(result.accessToken),
          encryptedRefreshToken: result.refreshToken
            ? this.tokenCrypto.encrypt(result.refreshToken)
            : account.encryptedRefreshToken,
          tokenExpiresAt: result.tokenExpiresAt ?? null,
          lastValidatedAt: new Date(),
          lastErrorMessage: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Token refresh failed for social account ${account.id}: ${message}`);

      const updated = await this.prisma.socialAccount.update({
        where: { id: account.id },
        data: { status: SocialAccountStatus.TOKEN_EXPIRED, lastErrorMessage: message },
      });

      await this.notifyTokenExpired(updated);
      return updated;
    }
  }

  /**
   * The publish pipeline's only route to a usable token. TokenCryptoService stays unexported, so
   * decryption never leaves this module.
   *
   * MUST be called at execution time, never snapshotted at enqueue time: a TikTok token rotates
   * on a schedule, and a post scheduled two weeks out long outlives the 3-day proactive refresh
   * window in TokenRefreshProcessor.
   */
  async getPublishCredentials(accountId: string): Promise<{
    platform: SocialAccount["platform"];
    externalAccountId: string;
    accessToken: string;
    metadata: Record<string, unknown> | null;
  }> {
    const account = await this.prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException("Social account not found.");

    if (account.status !== SocialAccountStatus.CONNECTED) {
      throw new BadRequestException(
        `${account.displayName} is ${account.status.toLowerCase().replace("_", " ")} — reconnect it before publishing.`,
      );
    }
    if (!account.encryptedAccessToken) {
      throw new BadRequestException(`${account.displayName} has no stored access token.`);
    }

    return {
      platform: account.platform,
      externalAccountId: account.externalAccountId,
      accessToken: this.tokenCrypto.decrypt(account.encryptedAccessToken),
      metadata: (account.metadata as Record<string, unknown> | null) ?? null,
    };
  }

  /**
   * Flips an account to ERROR after a publish rejected its token, and notifies the workspace's
   * owner/admins — mirrors what a failed scheduled refresh does.
   */
  async markAccountUnhealthy(accountId: string, message: string): Promise<void> {
    const account = await this.prisma.socialAccount.update({
      where: { id: accountId },
      data: { status: SocialAccountStatus.TOKEN_EXPIRED, lastErrorMessage: message.slice(0, 500) },
    });
    await this.notifyTokenExpired(account);
  }

  /** Accounts whose access token expires within the given window and still look CONNECTED. */
  async findAccountsNeedingRefresh(withinMs: number): Promise<SocialAccount[]> {
    return this.prisma.socialAccount.findMany({
      where: {
        status: SocialAccountStatus.CONNECTED,
        tokenExpiresAt: { not: null, lt: new Date(Date.now() + withinMs) },
      },
    });
  }

  private async notifyTokenExpired(account: SocialAccount): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: account.workspaceId },
      select: {
        ownerId: true,
        name: true,
        members: {
          where: { role: { in: [WorkspaceRole.ADMIN, WorkspaceRole.OWNER] } },
          select: { userId: true },
        },
      },
    });
    if (!workspace) return;

    const recipientIds = new Set<string>([workspace.ownerId, ...workspace.members.map((m) => m.userId)]);
    await this.prisma.notification.createMany({
      data: Array.from(recipientIds).map((userId) => ({
        workspaceId: account.workspaceId,
        userId,
        type: NotificationType.TOKEN_EXPIRING,
        title: `${account.platform} connection needs attention`,
        body: `"${account.displayName}" (${account.platform.toLowerCase()}) has stopped refreshing — reconnect it in Settings -> Connections to keep publishing to it.`,
      })),
    });
  }

  private connectablePlatformFor(account: {
    platform: SocialAccount["platform"];
  }): ConnectablePlatform | null {
    // Instagram accounts publish through the Facebook Page token they were discovered with, so
    // token operations (refresh/revoke) route through the Facebook provider too.
    if (account.platform === "FACEBOOK" || account.platform === "INSTAGRAM") return "facebook";
    if (account.platform === "TIKTOK") return "tiktok";
    return null;
  }

  private toResponseDto(account: SocialAccount): SocialAccountResponseDto {
    return {
      id: account.id,
      platform: account.platform,
      externalAccountId: account.externalAccountId,
      displayName: account.displayName,
      handle: account.handle,
      avatarUrl: account.avatarUrl,
      status: account.status,
      tokenExpiresAt: account.tokenExpiresAt,
      scopes: account.scopes,
      connectedById: account.connectedById,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
