"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  PenSquare,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./workspace-switcher";

const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: typeof FileText }[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Content",
    items: [
      { href: "/composer", label: "Composer", icon: PenSquare },
      { href: "/content", label: "All content", icon: FileText },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/media", label: "Media", icon: ImageIcon },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/templates", label: "Templates", icon: Sparkles },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/settings/members", label: "Members", icon: Users },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

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
            <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            {group.items.map(({ href, label, icon: Icon }) => {
              // `startsWith` so nested routes (/settings/connections) keep the parent highlighted,
              // but exact-match /dashboard so it isn't lit up on every page.
              const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-background font-medium text-foreground shadow-sm"
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
        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        Documentation
      </Link>
    </div>
  );
}
