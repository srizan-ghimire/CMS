import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

/** Figures come from the product's own vocabulary, not invented traction numbers. */
const FACTS = [
  { value: "8", label: "Networks" },
  { value: "1", label: "Composer" },
  { value: "∞", label: "Per-platform overrides" },
  { value: "3×", label: "Publish retries" },
];

export function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Headline column. Spans 8 of 12 and stops short of the gutter on purpose — the
              asymmetry against the 4-column note is what makes the grid legible. */}
          <div className="border-border py-16 sm:py-24 lg:col-span-8 lg:border-r lg:pr-12 lg:pt-32">
            <Reveal>
              <p className="marker text-muted-foreground">
                00 &nbsp;/&nbsp; Social content management
              </p>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="display-tight mt-8 text-[3.25rem] sm:text-[5rem] lg:text-[6.5rem]">
                Compose once.
                <br />
                <span className="text-muted-foreground">Ship</span> everywhere.
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="mt-12 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="xl">
                  <Link href="/register">
                    Start free
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="xl" variant="outline">
                  <a href="#how">See how it works</a>
                </Button>
              </div>
            </Reveal>
          </div>

          {/* Note column. Set at body scale against the display type, the way a caption sits
              against a plate. */}
          <div className="flex flex-col justify-end border-t border-border py-12 lg:col-span-4 lg:border-t-0 lg:py-24 lg:pl-12">
            <Reveal delay={0.18}>
              <p className="marker text-muted-foreground">The premise</p>
              <p className="mt-6 text-lg leading-relaxed text-foreground">
                One caption is never one caption. It is a Facebook post, a shorter Instagram
                caption, and a TikTok hook — each needing its own crop, its own tags, its own
                approval.
              </p>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Write it once, override what differs, route it through review, schedule it, and let
                the queue handle the retries.
              </p>
            </Reveal>
          </div>
        </div>
      </div>

      {/* Fact strip. tabular-nums matches how the dashboard sets every figure in the product. */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {FACTS.map((fact, index) => (
              <div
                key={fact.label}
                className={[
                  "border-border py-8",
                  index % 2 === 0 ? "pr-6" : "border-l pl-6",
                  "lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0",
                  index < 2 ? "border-b lg:border-b-0" : "",
                ].join(" ")}
              >
                <dd className="font-display text-4xl font-bold tabular-nums tracking-[-0.03em]">
                  {fact.value}
                </dd>
                <dt className="marker mt-3 text-muted-foreground">{fact.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
