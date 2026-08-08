import { Module } from "@nestjs/common";
import { AuthProvidersController } from "./auth-providers.controller";

/**
 * Deliberately not named AuthModule — that name belongs to `@thallesp/nestjs-better-auth`, which
 * app.module.ts already imports as `AuthModule.forRoot({ auth })`.
 */
@Module({ controllers: [AuthProvidersController] })
export class AuthProvidersModule {}
