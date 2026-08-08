"use client";

import { AlertTriangle } from "lucide-react";
import type { SocialAccountSummary, SocialPlatform } from "@social-platform/shared";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/misc";
import { PlatformIcon, platformLabel } from "./platform-icon";

export function AccountSelector({
  accounts,
  selectedIds,
  onToggle,
  disabled,
}: {
  accounts: SocialAccountSummary[];
  selectedIds: string[];
  onToggle: (accountId: string) => void;
  disabled?: boolean;
}) {
  if (accounts.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
        No connected accounts.{" "}
        <a href="/settings/connections" className="text-primary hover:underline">
          Connect one
        </a>{" "}
        to start publishing.
      </p>
    );
  }

  const byPlatform = accounts.reduce<Record<string, SocialAccountSummary[]>>((acc, account) => {
    (acc[account.platform] ??= []).push(account);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(byPlatform).map(([platform, group]) => (
        <div key={platform} className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <PlatformIcon platform={platform as SocialPlatform} className="h-3.5 w-3.5" />
            {platformLabel(platform as SocialPlatform)}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.map((account) => {
              const selected = selectedIds.includes(account.id);
              // A revoked or expired connection cannot publish, so it can't be targeted — the
              // composer refuses it up front rather than letting the publish job discover it.
              const unusable = account.status !== "CONNECTED";
              return (
                <button
                  key={account.id}
                  type="button"
                  disabled={disabled || unusable}
                  onClick={() => onToggle(account.id)}
                  aria-pressed={selected}
                  title={unusable ? `Connection ${account.status.toLowerCase()}` : account.displayName}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:bg-accent",
                    (disabled || unusable) && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Avatar className="h-5 w-5">
                    {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt="" />}
                    <AvatarFallback>{account.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="max-w-[140px] truncate">{account.displayName}</span>
                  {unusable && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
