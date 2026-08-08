import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { SchedulingService } from "../scheduling.service";
import { OAuthStateService } from "../../social-accounts/oauth-state.service";

export const SCHEDULING_QUEUE = "scheduling-sweeps";
export const DUE_SWEEP_JOB = "sweep-due-posts";
export const RECURRENCE_JOB = "materialize-recurrences";
export const OAUTH_STATE_CLEANUP_JOB = "purge-expired-oauth-states";

/** Repeatable maintenance jobs. Registered once in SchedulingModule.onModuleInit. */
@Processor(SCHEDULING_QUEUE)
export class ScheduleSweepProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduleSweepProcessor.name);

  constructor(
    private readonly scheduling: SchedulingService,
    private readonly oauthState: OAuthStateService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case DUE_SWEEP_JOB:
        return this.scheduling.sweepDuePosts();
      case RECURRENCE_JOB:
        return this.scheduling.materializeRecurrences();
      case OAUTH_STATE_CLEANUP_JOB: {
        // OAuthStateService.purgeExpired has existed since Phase 4 with no caller — expired rows
        // have simply been accumulating.
        const purged = await this.oauthState.purgeExpired();
        if (purged > 0) this.logger.log(`Purged ${purged} expired OAuth state row(s)`);
        return { purged };
      }
      default:
        return { ignored: job.name };
    }
  }
}
