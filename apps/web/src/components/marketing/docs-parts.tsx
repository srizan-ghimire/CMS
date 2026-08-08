import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One numbered chapter. The id is the anchor the sidebar links to. */
export function DocsSection({
  id,
  n,
  title,
  lede,
  children,
}: {
  id: string;
  n: string;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-14 first:border-t-0 first:pt-0">
      <p className="marker text-muted-foreground">{n}</p>
      <h2 className="display-tight mt-4 text-3xl sm:text-4xl">{title}</h2>
      {lede && <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">{lede}</p>}
      <div className="mt-8 max-w-2xl space-y-5 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li key={index} className="flex gap-4">
          <span className="marker mt-1 shrink-0 tabular-nums text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * `tone` maps onto the same border/tint ladder the app uses for status surfaces, so a warning here
 * reads the same as a warning in the product.
 */
export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: "note" | "warning" | "limit";
  title: string;
  children: ReactNode;
}) {
  const tones = {
    note: "border-primary/40 bg-primary/5",
    warning: "border-warning/40 bg-warning/5",
    limit: "border-border border-dashed bg-transparent",
  } as const;

  return (
    <div className={cn("border px-4 py-3.5", tones[tone])}>
      <p className="marker">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export function DocsTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | ReactNode)[][];
}) {
  return (
    // Wide tables scroll inside their own box rather than making the page scroll sideways.
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {head.map((cell) => (
              <th key={cell} className="marker px-4 py-3 text-left font-normal text-muted-foreground">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-b-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-4 py-3 align-top",
                    j === 0 ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Term({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[0.8125rem] text-foreground">{children}</span>;
}
