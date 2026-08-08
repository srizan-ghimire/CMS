import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [WorkspacesModule, AdminModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
