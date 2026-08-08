import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark, Wordmark } from "@/components/marketing/logo";

/**
 * Shared frame for every page under (auth). Carries the same rule grid, mono markers and display
 * type as the marketing pages so the signup funnel does not visibly change hands halfway through.
 *
 * The editorial panel is desktop-only — on a phone it would just push the form below the fold.
 */
export function AuthShell({
  marker,
  title,
  subtitle,
  children,
  footer,
}: {
  marker: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-12">
      <aside className="hidden border-r border-border bg-muted/40 lg:col-span-5 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:col-span-4">
        <Link href="/" aria-label="Social Platform home">
          <Wordmark />
        </Link>

        <div>
          <p className="marker text-muted-foreground">The premise</p>
          <p className="display-tight mt-6 text-4xl xl:text-5xl">
            Compose once.
            <br />
            Ship everywhere.
          </p>
          <p className="mt-7 max-w-sm text-sm leading-relaxed text-muted-foreground">
            One caption, overridden per network, routed through approval, scheduled, and published
            with retries — with a delivery record for every attempt.
          </p>
        </div>

        <dl className="grid grid-cols-3 border-t border-border pt-8">
          {[
            { v: "8", l: "Networks" },
            { v: "1", l: "Composer" },
            { v: "3×", l: "Retries" },
          ].map((stat) => (
            <div key={stat.l}>
              <dd className="font-display text-2xl font-bold tabular-nums tracking-[-0.03em]">
                {stat.v}
              </dd>
              <dt className="marker mt-2 text-muted-foreground">{stat.l}</dt>
            </div>
          ))}
        </dl>
      </aside>

      <main className="flex min-h-screen flex-col justify-center px-5 py-12 sm:px-8 lg:col-span-7 lg:px-16 xl:col-span-8">
        <div className="w-full max-w-[26rem]">
          <Link href="/" className="mb-10 inline-flex lg:hidden" aria-label="Social Platform home">
            <LogoMark className="h-6 w-6 text-primary" />
          </Link>

          <p className="marker text-muted-foreground">{marker}</p>
          <h1 className="display-tight mt-5 text-4xl sm:text-5xl">{title}</h1>
          {subtitle && (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          )}

          <div className="mt-10">{children}</div>

          {footer && <div className="mt-8 border-t border-border pt-6">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** Label + control + error, so the three auth forms stay identical in rhythm. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="marker text-muted-foreground">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
