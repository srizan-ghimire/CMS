import { Module, type OnModuleInit } from "@nestjs/common";
import { BullModule, InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { SchedulingController } from "./scheduling.controller";
import { SchedulingService } from "./scheduling.service";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { PostsModule } from "../posts/posts.module";
import { SocialAccountsModule } from "../social-accounts/social-accounts.module";
import {
  ScheduleSweepProcessor,
  SCHEDULING_QUEUE,
  DUE_SWEEP_JOB,
  RECURRENCE_JOB,
  OAUTH_STATE_CLEANUP_JOB,
} from "./processors/schedule-sweep.processor";

// This module owns only the recurring sweeps and the calendar read model. The publish pipeline
// itself lives inside `posts`, because PostTarget belongs to posts and a separate publishing
// module would create a posts <-> publishing cycle.
@Module({
  imports: [
    BullModule.registerQueue({ name: SCHEDULING_QUEUE }),
    WorkspacesModule,
    PostsModule,
    SocialAccountsModule,
  ],
  controllers: [SchedulingController],
  providers: [SchedulingService, ScheduleSweepProcessor],
  exports: [SchedulingService],
})
export class SchedulingModule implements OnModuleInit {
  constructor(@InjectQueue(SCHEDULING_QUEUE) private readonly queue: Queue) {}

  // Repeatable jobs are idempotent by job id, so re-registering on every boot is safe.
  async onModuleInit(): Promise<void> {
    await this.queue.add(
      DUE_SWEEP_JOB,
      {},
      { jobId: DUE_SWEEP_JOB, repeat: { every: 60_000 }, removeOnComplete: 20, removeOnFail: 50 },
    );
    await this.queue.add(
      RECURRENCE_JOB,
      {},
      { jobId: RECURRENCE_JOB, repeat: { every: 60 * 60_000 }, removeOnComplete: 20, removeOnFail: 50 },
    );
    await this.queue.add(
      OAUTH_STATE_CLEANUP_JOB,
      {},
      { jobId: OAUTH_STATE_CLEANUP_JOB, repeat: { every: 60 * 60_000 }, removeOnComplete: 5 },
    );
  }
}
