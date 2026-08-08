import type { SocialPlatform } from "@social-platform/shared";
import { PlatformIcon, platformLabel } from "@/components/composer/platform-icon";
import { Reveal } from "./reveal";

/**
 * Every platform the schema models, with an honest marker for the three that actually have an
 * OAuth provider today. Quietly listing eight and shipping three would be the kind of thing this
 * page is trying not to do.
 */
const PLATFORMS: { platform: SocialPlatform; live: boolean }[] = [
  { platform: "FACEBOOK", live: true },
  { platform: "INSTAGRAM", live: true },
  { platform: "TIKTOK", live: true },
  { platform: "LINKEDIN", live: false },
  { platform: "TWITTER", live: false },
  { platform: "THREADS", live: false },
  { platform: "PINTEREST", live: false },
  { platform: "YOUTUBE", live: false },
];

export function PlatformStrip() {
  return (
    <section id="platforms" className="border-b border-border">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4 py-8">
          <p className="marker text-muted-foreground">01 &nbsp;/&nbsp; Networks</p>
          <p className="marker text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 translate-y-[-1px] bg-success" /> &nbsp;
            Connected today
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
          <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            {PLATFORMS.map(({ platform, live }, index) => (
              <Reveal
                as="li"
                key={platform}
                delay={index * 0.04}
                className="group relative border-b border-l border-border py-9 first:border-l-0 sm:[&:nth-child(4n+1)]:border-l-0 lg:border-b-0 lg:[&:nth-child(4n+1)]:border-l lg:[&:nth-child(8n+1)]:border-l-0"
              >
                <div className="flex flex-col items-center gap-3">
                  <PlatformIcon
                    platform={platform}
                    className={
                      live
                        ? "h-6 w-6 text-foreground"
                        : "h-6 w-6 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
                    }
                  />
                  <span
                    className={
                      live
                        ? "marker text-foreground"
                        : "marker text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
                    }
                  >
                    {platformLabel(platform)}
                  </span>
                </div>
                {live && (
                  <span
                    className="absolute right-3 top-3 h-1.5 w-1.5 bg-success"
                    aria-label="Connected"
                  />
                )}
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
