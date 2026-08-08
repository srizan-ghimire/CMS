import { Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { SocialPlatform } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough for a consent screen, no longer

export interface CreateOAuthStateInput {
  platform: SocialPlatform;
  workspaceId: string;
  userId: string;
  codeVerifier?: string;
  redirectPath?: string;
}

export interface ConsumedOAuthState {
  platform: SocialPlatform;
  workspaceId: string;
  userId: string;
  codeVerifier: string | null;
  redirectPath: string;
}

@Injectable()
export class OAuthStateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOAuthStateInput): Promise<string> {
    const state = randomBytes(32).toString("base64url");
    await this.prisma.oAuthState.create({
      data: {
        state,
        platform: input.platform,
        workspaceId: input.workspaceId,
        userId: input.userId,
        codeVerifier: input.codeVerifier,
        redirectPath: input.redirectPath ?? "/settings/connections",
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      },
    });
    return state;
  }

  /**
   * Validates and deletes a state row in one shot (single use — a replayed `state` value must
   * fail). Throws rather than returning null so controllers don't have to remember to check.
   */
  async consume(state: string, expectedPlatform: SocialPlatform): Promise<ConsumedOAuthState> {
    const row = await this.prisma.oAuthState.findUnique({ where: { state } });

    // Delete eagerly (if found) so a state value can never be replayed, even if a later check
    // in this method throws.
    if (row) {
      await this.prisma.oAuthState.delete({ where: { state } }).catch(() => undefined);
    }

    if (!row) {
      throw new UnauthorizedException("This connection request is invalid or has expired.");
    }
    if (row.platform !== expectedPlatform) {
      throw new UnauthorizedException("This connection request does not match the platform.");
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("This connection request has expired — please try again.");
    }

    return {
      platform: row.platform,
      workspaceId: row.workspaceId,
      userId: row.userId,
      codeVerifier: row.codeVerifier,
      redirectPath: row.redirectPath,
    };
  }

  /** Sweeps rows past their TTL that were never completed (user closed the consent tab, etc). */
  async purgeExpired(): Promise<number> {
    const result = await this.prisma.oAuthState.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
