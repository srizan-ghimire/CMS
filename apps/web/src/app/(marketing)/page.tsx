import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { PlatformStrip } from "@/components/marketing/platform-strip";
import { ComposerExhibit } from "@/components/marketing/composer-exhibit";
import { CapabilityRows } from "@/components/marketing/capability-rows";
import { ScopePanel, ClosingCta } from "@/components/marketing/scope-panel";

export const metadata: Metadata = {
  // Overrides the "%s | Social Platform" template — the home page carries the full name already.
  title: "Social Platform — one composer, every network",
  description:
    "Compose once, override per platform, route through approval, schedule, and publish with retries. A social content CMS for teams running Facebook, Instagram, and TikTok.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <PlatformStrip />
      <ComposerExhibit />
      <CapabilityRows />
      <ScopePanel />
      <ClosingCta />
    </>
  );
}
