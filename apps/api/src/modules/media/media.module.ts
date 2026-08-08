import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { StorageService } from "./lib/storage.service";
import { MediaProcessingProcessor, MEDIA_QUEUE } from "./processors/media-processing.processor";
import { WorkspacesModule } from "../workspaces/workspaces.module";

@Module({
  imports: [BullModule.registerQueue({ name: MEDIA_QUEUE }), WorkspacesModule],
  controllers: [MediaController],
  providers: [MediaService, StorageService, MediaProcessingProcessor],
  // StorageService is exported because the publish pipeline (Stage 5) needs to resolve
  // internet-reachable media URLs; MediaService because `posts` resolves assets through it rather
  // than querying media tables directly.
  exports: [MediaService, StorageService],
})
export class MediaModule {}
