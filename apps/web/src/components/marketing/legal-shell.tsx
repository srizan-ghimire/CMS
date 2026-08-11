import type { ReactNode } from "react";
import Link from "next/link";
import { EFFECTIVE_DATE } from "@/lib/legal";

/**
 * Frame for the three legal documents. Same header, contents sidebar and measure as the docs page
 * — these are reference material and should read like it, rather than arriving in a different
 * visual language because a lawyer wrote them.
 *
 * The contents list is the one thing worth the extra component: all three documents are long
 * enough that a reader arriving from a Meta review form needs to jump to a specific clause.
 */
export function LegalShell({
  marker,
  title,
  lede,
  contents,
  children,
}: {
  marker: string;
  title: string;
  lede: string;
  contents: { id: string; n: string; title: string }[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
      <header className="border-border border-b py-14 lg:py-24">
        <p className="marker text-muted-foreground">{marker}</p>
        <h1 className="display-tight mt-6 max-w-3xl text-4xl sm:text-6xl">{title}</h1>
        <p className="text-muted-foreground mt-7 max-w-2xl text-lg leading-relaxed">{lede}</p>
        <p className="marker text-muted-foreground mt-8">Effective {EFFECTIVE_DATE}</p>
      </header>

      <div className="lg:grid lg:grid-cols-12 lg:gap-x-12">
        <aside className="border-border border-b py-8 lg:col-span-3 lg:border-b-0 lg:border-r lg:py-14 lg:pr-8">
          <nav aria-label="Contents" className="lg:sticky lg:top-24">
            <p className="marker text-muted-foreground">Contents</p>
            <ol className="mt-5 space-y-2.5">
              {contents.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-muted-foreground hover:text-foreground flex gap-3 text-sm transition-colors"
                  >
                    <span className="marker mt-0.5 tabular-nums">{item.n}</span>
                    <span>{item.title}</span>
                  </a>
                </li>
              ))}
            </ol>

            <p className="marker text-muted-foreground mt-8">Related</p>
            <ul className="mt-5 space-y-2.5 text-sm">
              <li>
                <LegalLink href="/privacy">Privacy Policy</LegalLink>
              </li>
              <li>
                <LegalLink href="/terms">Terms of Service</LegalLink>
              </li>
              <li>
                <LegalLink href="/data-deletion">Delete your data</LegalLink>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="lg:col-span-9 lg:py-14">{children}</main>
      </div>
    </div>
  );
}

function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
      {children}
    </Link>
  );
}

/** Inline link styling used throughout the three documents, so they cannot drift apart. */
export function Inline({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("http");
  return (
    <Link
      href={href}
      className="hover:text-foreground underline underline-offset-4"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
