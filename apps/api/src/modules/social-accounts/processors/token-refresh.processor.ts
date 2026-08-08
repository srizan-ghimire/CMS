import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { SocialAccountsService } from "../social-accounts.service";

// No colons: BullMQ uses ":" as its own Redis key separator and rejects queue names containing
// one ("Queue name cannot contain :").
export const TOKEN_REFRESH_QUEUE = "social-accounts-token-refresh";
export const TOKEN_REFRESH_SWEEP_JOB = "sweep-expiring-tokens";

// Any token expiring within this window gets a proactive refresh attempt, rather than waiting
// for it to actually fail on the next publish/analytics call.
const REFRESH_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

@Processor(TOKEN_REFRESH_QUEUE)
export class TokenRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(TokenRefreshProcessor.name);

  constructor(private readonly socialAccountsService: SocialAccountsService) {
    super();
  }

  async process(job: Job): Promise<{ checked: number; refreshed: number; failed: number }> {
    if (job.name !== TOKEN_REFRESH_SWEEP_JOB) {
      return { checked: 0, refreshed: 0, failed: 0 };
    }

    const accounts = await this.socialAccountsService.findAccountsNeedingRefresh(REFRESH_WINDOW_MS);
    this.logger.log(`Token refresh sweep: ${accounts.length} account(s) due for refresh`);

    let refreshed = 0;
    let failed = 0;

    for (const account of accounts) {
      const before = account.status;
      const result = await this.socialAccountsService.refreshAccount(account);
      if (result.status === "CONNECTED" && before !== "CONNECTED") {
        refreshed++;
      } else if (result.status === "TOKEN_EXPIRED") {
        failed++;
      } else if (result.status === "CONNECTED") {
        refreshed++;
      }
    }

    return { checked: accounts.length, refreshed, failed };
  }
}
