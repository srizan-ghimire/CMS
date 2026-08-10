"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { motion, useReducedMotion } from "@/components/ui/motion";
import { PRIMARY_TABS, isNavItemActive } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { NavDrawer } from "./nav-drawer";

/**
 * Bottom navigation for phones. Exists because the desktop sidebar is `md:block` — before this,
 * a phone could reach /dashboard and then had no way to leave it.
 *
 * Four routes plus More. Every tab is at least 44px tall and the bar clears the iOS home
 * indicator via `env(safe-area-inset-bottom)`, which only resolves once the root layout opts into
 * `viewportFit: "cover"`.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const onPrimaryRoute = PRIMARY_TABS.some((tab) => isNavItemActive(tab.href, pathname));

  return (
    <nav
      aria-label="Primary"
      className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <ul className="grid grid-cols-5">
        {PRIMARY_TABS.map(({ href, label, shortLabel, icon: Icon }) => {
          const active = isNavItemActive(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 px-1 pt-1.5 text-[11px] transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {/* The indicator is shared across tabs by layoutId, so it slides to the new tab
                    instead of blinking out and in. Static under reduced motion. */}
                {active &&
                  (reduceMotion ? (
                    <span className="bg-primary absolute inset-x-3 top-0 h-0.5 rounded-full" />
                  ) : (
                    <motion.span
                      layoutId="tab-indicator"
                      className="bg-primary absolute inset-x-3 top-0 h-0.5 rounded-full"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ))}
                <Icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
                <span className="max-w-full truncate">{shortLabel ?? label}</span>
              </Link>
            </li>
          );
        })}

        <li>
          <NavDrawer>
            <button
              type="button"
              aria-haspopup="dialog"
              className={cn(
                "flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1 px-1 pt-1.5 text-[11px] transition-colors",
                // Lit whenever the current route has no tab of its own, so the bar never looks
                // like nothing is selected.
                onPrimaryRoute ? "text-muted-foreground" : "text-foreground",
              )}
            >
              <Menu className={cn("h-5 w-5 shrink-0", !onPrimaryRoute && "text-primary")} />
              More
            </button>
          </NavDrawer>
        </li>
      </ul>
    </nav>
  );
}
