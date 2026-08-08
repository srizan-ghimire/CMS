import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { PUBLISH_QUEUE } from "../posts/publishing/publishing.constants";
import { MEDIA_QUEUE } from "../media/processors/media-processing.processor";

@Module({
  imports: [
    WorkspacesModule,
    // registerQueue is idempotent — these queues are owned by posts/media, this only obtains a
    // client handle for reading job counts.
    BullModule.registerQueue({ name: PUBLISH_QUEUE }, { name: MEDIA_QUEUE }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
