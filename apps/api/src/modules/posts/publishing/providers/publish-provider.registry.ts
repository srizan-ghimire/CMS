import { Logger, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SocialPlatform } from "@prisma/client";
import type { PublishProvider } from "../interfaces/publish-provider.interface";
import { FacebookPublisher } from "./facebook.publisher";
import { InstagramPublisher } from "./instagram.publisher";
import { TikTokPublisher } from "./tiktok.publisher";
import { StubPublisher } from "./stub.publisher";

export const PUBLISH_PROVIDERS = Symbol("PUBLISH_PROVIDERS");

export type PublishProviderRegistry = Partial<Record<SocialPlatform, PublishProvider>>;

/**
 * Mirrors the structure of the OAuth-side `socialOAuthProviderRegistryFactory`.
 *
 * Selection rule: when `MEDIA_PUBLIC_BASE_URL` is unset — the normal local-dev state — every
 * platform resolves to the StubPublisher. Facebook and Instagram publish by handing Meta a URL
 * that Meta's own servers fetch, and localhost is unreachable from Meta, so the real providers
 * cannot work without a public media host. Falling back to the stub keeps the whole pipeline
 * runnable and demoable locally instead of failing deep inside a queue job.
 *
 * In production that same fallback would be a disaster — posts reported as published that never
 * left the building — so there it throws instead. `configuration.ts` already rejects the missing
 * variable at boot; this is the second line of defence for anything that bypasses validateEnv.
 */
export const publishProviderRegistryFactory: Provider = {
  provide: PUBLISH_PROVIDERS,
  useFactory: (
    config: ConfigService,
    facebook: FacebookPublisher,
    instagram: InstagramPublisher,
    tiktok: TikTokPublisher,
  ): PublishProviderRegistry => {
    const logger = new Logger("PublishProviderRegistry");
    const publicBase = config.get<string>("media.publicBaseUrl");

    if (!publicBase) {
      if (config.get<string>("env") === "production") {
        throw new Error(
          "MEDIA_PUBLIC_BASE_URL is not set. Refusing to start in production with the stub " +
            "publisher, which would mark posts as published without sending them anywhere.",
        );
      }
      logger.warn(
        "MEDIA_PUBLIC_BASE_URL is not set — using the stub publisher for all platforms. " +
          "Nothing will be sent to a real social network.",
      );
      return {
        [SocialPlatform.FACEBOOK]: new StubPublisher(SocialPlatform.FACEBOOK),
        [SocialPlatform.INSTAGRAM]: new StubPublisher(SocialPlatform.INSTAGRAM),
        [SocialPlatform.TIKTOK]: new StubPublisher(SocialPlatform.TIKTOK),
      };
    }

    return {
      [SocialPlatform.FACEBOOK]: facebook,
      [SocialPlatform.INSTAGRAM]: instagram,
      [SocialPlatform.TIKTOK]: tiktok,
    };
  },
  inject: [ConfigService, FacebookPublisher, InstagramPublisher, TikTokPublisher],
};
