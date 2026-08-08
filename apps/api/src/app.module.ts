import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { BullModule } from "@nestjs/bullmq";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import configuration, { validateEnv } from "./config/configuration";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./common/audit/audit.module";
import { HealthModule } from "./modules/health/health.module";
import { auth } from "./modules/auth/lib/auth";
import { AuthProvidersModule } from "./modules/auth/auth-providers.module";
import { UsersModule } from "./modules/users/users.module";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";
import { SocialAccountsModule } from "./modules/social-accounts/social-accounts.module";
import { PostsModule } from "./modules/posts/posts.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
import { MediaModule } from "./modules/media/media.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AiModule } from "./modules/ai/ai.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AdminModule } from "./modules/admin/admin.module";
import { SearchModule } from "./modules/search/search.module";
import { OrganizationModule } from "./modules/organization/organization.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        transport:
          process.env.NODE_ENV === "production"
            ? undefined
            : { target: "pino-pretty", options: { singleLine: true } },
        redact: ["req.headers.authorization", "req.headers.cookie"],
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL },
    }),
    PrismaModule,
    AuditModule,
    HealthModule,
    // Registers Better Auth's routes under /api/auth/* AND a global AuthGuard — every
    // route in the app requires a session by default. Mark individual routes/controllers
    // @AllowAnonymous() or @OptionalAuth() (from "@thallesp/nestjs-better-auth") to opt out.
    AuthModule.forRoot({ auth }),
    AuthProvidersModule,
    UsersModule,
    WorkspacesModule,
    SocialAccountsModule,
    PostsModule,
    SchedulingModule,
    MediaModule,
    AnalyticsModule,
    AiModule,
    NotificationsModule,
    AdminModule,
    SearchModule,
    OrganizationModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
