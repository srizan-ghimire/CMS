import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from "@nestjs/terminus";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { PrismaService } from "../../prisma/prisma.service";

// VERSION_NEUTRAL matters: main.ts excludes "health" from the global "api" prefix, but URI
// versioning still applies to every controller — so without this the route lands on /v1/health
// while the README, deployment probes and container healthchecks all expect /health.
@AllowAnonymous()
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.prismaIndicator.pingCheck("database", this.prisma)]);
  }
}
