import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

/**
 * The honest-scope section. Two capabilities in this product are narrower than their name
 * suggests, and both say so at their own API surface — saying so here too costs nothing and is
 * more useful to someone evaluating it than another feature tile would be.
 */
const LIMITS = [
  {
    title: "Analytics reports delivery, not reach",
    body: "Volume, success rate, retries, failures — all from this platform's own publish record. Impressions, reach, and engagement need each network's insights API, which is not wired up. Inventing those numbers would be worse than omitting them.",
  },
  {
    title: "AI is a caption assistant, not a strategist",
    body: "One request, one response: rewrite, shorten, adjust tone. It sits behind a feature flag, needs your own API key, and has no interface in the app yet — only an endpoint. There is no autonomous agent planning your calendar.",
  },
  {
    title: "Five networks are modelled, not connected",
    body: "Facebook, Instagram, and TikTok have working OAuth and publishing today. LinkedIn, X, Threads, Pinterest, and YouTube exist in the schema and the composer, but have no provider yet.",
  },
];

export function ScopePanel() {
  return (
    <section id="scope" className="border-b border-border bg-muted/40">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="border-border py-16 lg:col-span-4 lg:border-r lg:py-24 lg:pr-12">
            <Reveal>
              <p className="marker text-muted-foreground">08 &nbsp;/&nbsp; Scope</p>
              <h2 className="display-tight mt-7 text-4xl sm:text-5xl">
                What this
                <br />
                does not do.
              </h2>
              <p className="mt-7 text-base leading-relaxed text-muted-foreground">
                Every tool in this category claims everything. Here is the short list of what is
                deliberately narrower than it sounds, so you can rule it out early instead of
                halfway through a migration.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-8 lg:pl-12">
            <ul className="lg:pt-24">
              {LIMITS.map((limit, index) => (
                <Reveal
                  as="li"
                  key={limit.title}
                  delay={index * 0.07}
                  className="border-t border-border py-9 first:border-t-0 lg:first:border-t"
                >
                  <div className="flex gap-5">
                    <span className="marker mt-1.5 shrink-0 text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">{limit.title}</h3>
                      <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        {limit.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-10 py-20 lg:flex-row lg:items-end lg:py-28">
          <Reveal>
            <p className="marker text-muted-foreground">Get started</p>
            <h2 className="display-tight mt-7 max-w-2xl text-5xl sm:text-7xl">
              Connect an account.
              <br />
              Publish today.
            </h2>
          </Reveal>

          <Reveal delay={0.08} className="shrink-0">
            <Button asChild size="xl">
              <Link href="/register">
                Create an account
                <ArrowRight />
              </Link>
            </Button>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Already have one?{" "}
              <Link href="/login" className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
