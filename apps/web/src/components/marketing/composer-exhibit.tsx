import type { MediaAssetDto, SocialPlatform } from "@social-platform/shared";
import { PlatformPreview } from "@/components/composer/platform-preview";
import { platformLabel } from "@/components/composer/platform-icon";
import { Reveal } from "./reveal";

const BASE_CAPTION =
  "New drop: the Alto chair, finished by hand in oiled ash. 40 made, no restock. Link in bio.";

/**
 * The same source caption after each platform's override. This is the actual product behaviour —
 * PlatformPreview below is the identical component the composer renders, not a marketing mock of
 * it, so what you see here is what the editor shows.
 */
const OVERRIDES: {
  platform: SocialPlatform;
  caption: string;
  note: string;
}[] = [
  {
    platform: "FACEBOOK",
    caption: BASE_CAPTION,
    note: "Base caption, unchanged",
  },
  {
    platform: "INSTAGRAM",
    caption:
      "New drop 🪑 The Alto chair — hand-finished oiled ash.\n40 made. No restock.\n\n#furnituredesign #ashwood #smallbatch",
    note: "Hashtags appended, link removed",
  },
  {
    platform: "TIKTOK",
    caption: "40 chairs. Hand-finished. Then they're gone.",
    note: "Shortened to a hook",
  },
];

const NO_MEDIA: MediaAssetDto[] = [];

export function ComposerExhibit() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="border-border py-16 lg:col-span-4 lg:border-r lg:pr-12 lg:py-24">
            <Reveal>
              <p className="marker text-muted-foreground">02 &nbsp;/&nbsp; Override</p>
              <h2 className="display-tight mt-7 text-4xl sm:text-5xl">
                One caption.
                <br />
                Three of them.
              </h2>
              <p className="mt-7 text-base leading-relaxed text-muted-foreground">
                Type the post once. Override only what actually differs per network — caption,
                crop, first comment, tags — and leave the rest inherited.
              </p>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="mt-10 border border-dashed border-border p-5">
                <p className="marker text-muted-foreground">Source</p>
                <p className="mt-3 text-sm leading-relaxed">{BASE_CAPTION}</p>
              </div>
            </Reveal>
          </div>

          <div className="py-12 lg:col-span-8 lg:py-24 lg:pl-12">
            <div className="grid gap-6 sm:grid-cols-3">
              {OVERRIDES.map((item, index) => (
                <Reveal key={item.platform} delay={0.1 + index * 0.08}>
                  <div className="flex items-baseline justify-between gap-2 pb-3">
                    <span className="marker">{platformLabel(item.platform)}</span>
                    <span className="marker text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <PlatformPreview
                    platform={item.platform}
                    accountName="Alto Studio"
                    accountHandle="altostudio"
                    accountAvatarUrl={null}
                    content={item.caption}
                    media={NO_MEDIA}
                  />
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{item.note}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
