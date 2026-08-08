import { Module, type OnModuleInit } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { SocialAccountsController } from "./social-accounts.controller";
import { SocialAccountsService } from "./social-accounts.service";
import { TokenCryptoService } from "./lib/token-crypto.service";
import { OAuthStateService } from "./oauth-state.service";
import { FacebookProvider } from "./providers/facebook.provider";
import { TikTokProvider } from "./providers/tiktok.provider";
import { socialOAuthProviderRegistryFactory } from "./providers/provider.registry";
import { TokenRefreshProcessor, TOKEN_REFRESH_QUEUE, TOKEN_REFRESH_SWEEP_JOB } from "./processors/token-refresh.processor";
import { WorkspacesModule } from "../workspaces/workspaces.module";

@Module({
  imports: [BullModule.registerQueue({ name: TOKEN_REFRESH_QUEUE }), WorkspacesModule],
  controllers: [SocialAccountsController],
  providers: [
    SocialAccountsService,
    TokenCryptoService,
    OAuthStateService,
    FacebookProvider,
    TikTokProvider,
    socialOAuthProviderRegistryFactory,
    TokenRefreshProcessor,
  ],
  exports: [SocialAccountsService, OAuthStateService],
})
export class SocialAccountsModule implements OnModuleInit {
  constructor(@InjectQueue(TOKEN_REFRESH_QUEUE) private readonly queue: Queue) {}

  // Schedules the recurring sweep once, on boot — BullMQ's repeatable jobs are idempotent by
  // job id, so this is safe to run on every app restart without stacking duplicate schedules.
  async onModuleInit(): Promise<void> {
    await this.queue.add(
      TOKEN_REFRESH_SWEEP_JOB,
      {},
      {
        jobId: TOKEN_REFRESH_SWEEP_JOB,
        repeat: { every: 6 * 60 * 60 * 1000 }, // every 6 hours
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    );
  }
}
