"use client";

import { PLATFORM_LIMITS, type SocialPlatform } from "@social-platform/shared";
import { cn } from "@/lib/utils";
import { platformLabel } from "./platform-icon";

/**
 * Counts against the strictest selected platform. Showing one number per platform would be noise;
 * showing only the widest would let the user sail past X's 280 without noticing.
 */
export function CharacterCounter({
  text,
  platforms,
  className,
}: {
  text: string;
  platforms: SocialPlatform[];
  className?: string;
}) {
  if (platforms.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{text.length}</span>;
  }

  const strictest = platforms.reduce((tightest, platform) =>
    PLATFORM_LIMITS[platform].maxChars < PLATFORM_LIMITS[tightest].maxChars ? platform : tightest,
  );
  const limit = PLATFORM_LIMITS[strictest].maxChars;
  const remaining = limit - text.length;

  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        remaining < 0 ? "font-medium text-destructive" : remaining < limit * 0.1 ? "text-warning" : "text-muted-foreground",
        className,
      )}
      title={`${platformLabel(strictest)} allows ${limit.toLocaleString()} characters`}
    >
      {remaining < 0
        ? `${Math.abs(remaining).toLocaleString()} over ${platformLabel(strictest)}'s limit`
        : `${remaining.toLocaleString()} left`}
    </span>
  );
}
