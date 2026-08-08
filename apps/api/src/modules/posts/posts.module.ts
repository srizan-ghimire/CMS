import { Module } from "@nestjs/common";
import { PostsController } from "./posts.controller";
import { PostsService } from "./posts.service";
import { ApprovalsController } from "./approvals.controller";
import { ApprovalsService } from "./approvals.service";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { MediaModule } from "../media/media.module";
import { SocialAccountsModule } from "../social-accounts/social-accounts.module";
import { BullModule } from "@nestjs/bullmq";
import { PublishingService } from "./publishing/publishing.service";
import { PublishingController } from "./publishing/publishing.controller";
import { PublishProcessor, PUBLISH_QUEUE } from "./publishing/processors/publish.processor";
import { FacebookPublisher } from "./publishing/providers/facebook.publisher";
import { InstagramPublisher } from "./publishing/providers/instagram.publisher";
import { TikTokPublisher } from "./publishing/providers/tiktok.publisher";
import { publishProviderRegistryFactory } from "./publishing/providers/publish-provider.registry";

@Module({
  imports: [WorkspacesModule, MediaModule, SocialAccountsModule, BullModule.registerQueue({ name: PUBLISH_QUEUE })],
  controllers: [PostsController, ApprovalsController, PublishingController],
  providers: [
    PostsService,
    ApprovalsService,
    PublishingService,
    PublishProcessor,
    FacebookPublisher,
    InstagramPublisher,
    TikTokPublisher,
    publishProviderRegistryFactory,
  ],
  exports: [PostsService, ApprovalsService, PublishingService],
})
export class PostsModule {}
