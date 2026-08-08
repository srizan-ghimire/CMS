"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./logo";

// Hash links only resolve on the landing page, so they are prefixed with "/" to work from /docs
// too — otherwise "#how" from /docs would look for a section that isn't on that page.
const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#platforms", label: "Networks" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="shrink-0" aria-label="Social Platform home">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="marker text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-1 md:flex">
          <Link
            href="/login"
            className="marker px-4 py-2.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="marker bg-foreground px-5 py-2.5 text-background transition-colors hover:bg-primary"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="-mr-2 p-2 md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border md:hidden">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="marker block border-b border-border px-5 py-4 text-muted-foreground"
            >
              {item.label}
            </a>
          ))}
          <div className="grid grid-cols-2">
            <Link
              href="/login"
              className="marker border-r border-border px-5 py-4 text-center text-muted-foreground"
            >
              Sign in
            </Link>
            <Link href="/register" className="marker bg-foreground px-5 py-4 text-center text-background">
              Start free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
