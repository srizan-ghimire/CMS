import { Provider } from "@nestjs/common";
import { ConnectablePlatform, SocialOAuthProvider } from "../interfaces/social-oauth-provider.interface";
import { FacebookProvider } from "./facebook.provider";
import { TikTokProvider } from "./tiktok.provider";

export const SOCIAL_OAUTH_PROVIDERS = Symbol("SOCIAL_OAUTH_PROVIDERS");

export type SocialOAuthProviderRegistry = Record<ConnectablePlatform, SocialOAuthProvider>;

export const socialOAuthProviderRegistryFactory: Provider = {
  provide: SOCIAL_OAUTH_PROVIDERS,
  useFactory: (facebook: FacebookProvider, tiktok: TikTokProvider): SocialOAuthProviderRegistry => ({
    facebook,
    tiktok,
  }),
  inject: [FacebookProvider, TikTokProvider],
};
