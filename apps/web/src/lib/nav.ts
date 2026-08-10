import {
  BarChart3,
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
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shortened for the bottom tab bar, where five labels share a 375px row. */
  shortLabel?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * The single source of navigation. The desktop sidebar, the mobile tab bar and the mobile drawer
 * all read from here — three hand-maintained copies would drift the moment a route is added.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortLabel: "Home" }],
  },
  {
    label: "Content",
    items: [
      { href: "/composer", label: "Composer", icon: PenSquare, shortLabel: "Compose" },
      { href: "/content", label: "All content", icon: FileText, shortLabel: "Content" },
      { href: "/calendar", label: "Calendar", icon: CalendarDays, shortLabel: "Calendar" },
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

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/**
 * The four destinations that get a permanent slot in the mobile tab bar; the fifth slot is "More",
 * which opens the full list. Four is the ceiling — five labels plus More stop being tappable at
 * 375px. Everything omitted here is still reachable through the drawer, so this is a ranking of
 * frequency, not of importance.
 */
export const PRIMARY_TAB_HREFS = ["/dashboard", "/composer", "/calendar", "/content"] as const;

export const PRIMARY_TABS: NavItem[] = PRIMARY_TAB_HREFS.map((href) => {
  const item = ALL_ITEMS.find((candidate) => candidate.href === href);
  // A typo here would silently drop a tab, so fail loudly at module load instead.
  if (!item) throw new Error(`PRIMARY_TAB_HREFS references an unknown route: ${href}`);
  return item;
});

/**
 * Whether a nav item should render as the current page.
 *
 * `startsWith` so nested routes (/settings/connections) keep their parent highlighted, but
 * /dashboard is matched exactly or it would light up on every route.
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}
