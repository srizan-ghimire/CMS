import Link from "next/link";
import { LogoMark } from "./logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/#how", label: "How it works" },
      { href: "/#platforms", label: "Networks" },
      { href: "/#scope", label: "What it does not do" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create account" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/data-deletion", label: "Delete your data" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        {/* 3 + 3×3 = 12. The brand block gave up two columns when Legal was added; the spare
            col-span-1 that used to absorb the remainder went with it. */}
        <div className="border-border grid grid-cols-1 gap-y-12 border-b py-16 sm:grid-cols-2 md:grid-cols-12 md:gap-x-8">
          <div className="sm:col-span-2 md:col-span-3">
            <LogoMark className="text-primary h-6 w-6" />
            <p className="font-display mt-5 max-w-xs text-2xl font-bold leading-[1.05] tracking-[-0.03em]">
              One composer.
              <br />
              Eight networks.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title} className="md:col-span-3">
              <p className="marker text-muted-foreground">{column.title}</p>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 py-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="marker text-muted-foreground">
            &copy; {new Date().getFullYear()} Social Platform
          </p>
          <p className="marker text-muted-foreground">Facebook · Instagram · TikTok connected</p>
        </div>
      </div>
    </footer>
  );
}
