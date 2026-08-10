"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_GROUPS, isNavItemActive } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./workspace-switcher";

/**
 * The full navigation as a bottom sheet, opened from the tab bar's "More". Everything the desktop
 * sidebar offers is reachable here — the tab bar is a shortcut to four routes, not a reduced app.
 *
 * Rises from the bottom rather than the side because it is summoned by a control at the bottom of
 * the screen; a panel that appears somewhere other than where you tapped costs a beat of
 * re-orientation.
 */
export function NavDrawer({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        // pb clears the iOS home indicator; the tab bar underneath is covered by the overlay.
        className="gap-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="px-4 pb-3 pt-4">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto px-4 pb-2">
          <div className="pb-4">
            <WorkspaceSwitcher />
          </div>

          <nav className="flex flex-col gap-5">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="marker text-muted-foreground px-1 pb-1">{group.label}</p>
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isNavItemActive(href, pathname);
                  return (
                    // SheetClose so tapping a destination dismisses the drawer. Without it the
                    // panel sits over the page you just navigated to.
                    <SheetClose asChild key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-md px-2 text-sm transition-colors",
                          active
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </Link>
                    </SheetClose>
                  );
                })}
              </div>
            ))}

            <SheetClose asChild>
              <Link
                href="/docs"
                className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex min-h-11 items-center gap-3 rounded-md px-2 text-sm transition-colors"
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                Documentation
              </Link>
            </SheetClose>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
