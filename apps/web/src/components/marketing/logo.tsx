import { cn } from "@/lib/utils";

/**
 * The mark: one filled square (the composed post) and three outlined ones offset from it (the
 * per-platform copies). It reads as a grid at any size, which is the point — it belongs to the
 * same rule system the marketing pages are built on.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("h-5 w-5", className)}
      shapeRendering="crispEdges"
    >
      <rect x="1" y="1" width="9" height="9" fill="currentColor" />
      <rect x="14" y="1" width="9" height="9" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="14" width="9" height="9" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="14" width="9" height="9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-[18px] w-[18px] text-primary" />
      <span className="font-display text-[0.9375rem] font-bold uppercase tracking-[0.16em]">
        Social
        <span className="text-muted-foreground">/</span>
        Platform
      </span>
    </span>
  );
}
