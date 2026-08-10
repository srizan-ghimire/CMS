"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { NAV_GROUPS, isNavItemActive } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-1">
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
          Social Platform
        </Link>
      </div>

      <WorkspaceSwitcher />

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="text-muted-foreground px-2 text-[11px] font-medium uppercase tracking-wider">
              {group.label}
            </p>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isNavItemActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-background text-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Docs live on the public marketing side, so this leaves the dashboard shell. */}
      <Link
        href="/docs"
        className="text-muted-foreground hover:bg-background/60 hover:text-foreground flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors"
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        Documentation
      </Link>
    </div>
  );
}
