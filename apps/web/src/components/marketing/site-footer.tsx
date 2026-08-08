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
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="grid grid-cols-1 gap-y-12 border-b border-border py-16 md:grid-cols-12 md:gap-x-8">
          <div className="md:col-span-5">
            <LogoMark className="h-6 w-6 text-primary" />
            <p className="mt-5 max-w-xs font-display text-2xl font-bold leading-[1.05] tracking-[-0.03em]">
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
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="md:col-span-1" />
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
