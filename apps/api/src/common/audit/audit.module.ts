import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";

/** Global: nearly every domain module records something, and threading an import through all of
 *  them would be noise. Mirrors how PrismaModule is registered. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
