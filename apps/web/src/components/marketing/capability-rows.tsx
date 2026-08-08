import { Reveal, DrawRule } from "./reveal";

/**
 * The lifecycle of a post in this system, in order. Each row is a numbered cell in the rule grid;
 * the detail column carries the specific mechanism rather than a benefit statement, because the
 * mechanism is the differentiator.
 */
const STAGES = [
  {
    n: "03",
    title: "Organize",
    lede: "Campaigns, labels, and full-text search across every draft you have ever written.",
    detail:
      "Postgres tsvector columns index caption bodies directly, so search returns the post you half-remember from four months ago rather than a list of everything.",
  },
  {
    n: "04",
    title: "Approve",
    lede: "Route drafts through review before anything reaches a network.",
    detail:
      "Role-aware: editors act on their own content, managers on anyone's. Every version is retained, so an approval always points at the exact text that was approved.",
  },
  {
    n: "05",
    title: "Schedule",
    lede: "A month view you can drag, not a list of timestamps.",
    detail:
      "Drag a post to another day to reschedule it. Times are stored as absolute instants, and a queue holds each post until its slot rather than firing on whatever the server clock happens to say.",
  },
  {
    n: "06",
    title: "Publish",
    lede: "Background jobs with retries and a full delivery record.",
    detail:
      "Every attempt is recorded — the platform's response, the error, the retry. When a post fails at 6am you find out why, not just that it did.",
  },
  {
    n: "07",
    title: "Measure",
    lede: "Content volume and delivery reliability, from this platform's own publish record.",
    detail:
      "How much you shipped, what succeeded first time, what needed retries, and what failed outright. See the scope note below for what this deliberately excludes.",
  },
];

export function CapabilityRows() {
  return (
    <section id="how" className="border-b border-border">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="py-16 lg:py-24">
          <Reveal>
            <p className="marker text-muted-foreground">The pipeline</p>
            <h2 className="display-tight mt-7 max-w-3xl text-4xl sm:text-6xl">
              What happens between writing it and it being live.
            </h2>
          </Reveal>
        </div>

        <ul>
          {STAGES.map((stage, index) => (
            <li key={stage.n}>
              <DrawRule delay={index * 0.04} />
              <Reveal className="grid grid-cols-1 gap-y-4 py-10 md:grid-cols-12 md:gap-x-8 lg:py-14">
                <div className="md:col-span-2">
                  <span className="font-display text-3xl font-bold tabular-nums leading-none tracking-[-0.04em] text-muted-foreground/35">
                    {stage.n}
                  </span>
                </div>

                <div className="md:col-span-4">
                  <h3 className="font-display text-2xl font-bold uppercase tracking-[-0.02em]">
                    {stage.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-base leading-relaxed">{stage.lede}</p>
                </div>

                <div className="md:col-span-5 md:col-start-8">
                  <p className="text-sm leading-relaxed text-muted-foreground">{stage.detail}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
