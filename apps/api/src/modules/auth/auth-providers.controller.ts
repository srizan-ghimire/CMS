import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { enabledSocialProviders, type SocialProviderId } from "./lib/auth";

export class AuthProvidersResponseDto {
  /** Social providers that are configured and will actually complete a sign-in. */
  social!: SocialProviderId[];
}

/**
 * Lets the sign-in UI ask which social providers are configured, instead of hardcoding a list that
 * silently rots. Better Auth registers a provider only when its credentials are present and 404s
 * `sign-in/social` for anything else, so a hardcoded button is a dead button the moment an
 * environment does not set that provider's keys.
 *
 * Mirroring the list into a NEXT_PUBLIC_ build arg would work too, but it would be a second copy
 * of the truth that only desyncs at runtime, on the login page, for real users.
 *
 * Anonymous by necessity — it is read by people who are not signed in yet. It exposes nothing but
 * which buttons to draw.
 */
@ApiTags("auth")
@Controller({ path: "auth/providers", version: "1" })
export class AuthProvidersController {
  @ApiOperation({ summary: "List the social login providers this deployment has configured" })
  @AllowAnonymous()
  @Get()
  list(): AuthProvidersResponseDto {
    return { social: enabledSocialProviders };
  }
}
