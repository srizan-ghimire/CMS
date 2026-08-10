import type { ReactNode } from "react";
import { TopBar } from "@/components/dashboard/top-bar";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileTabBar } from "@/components/dashboard/mobile-tab-bar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="border-border bg-muted/40 hidden w-64 shrink-0 border-r md:block">
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/95 sticky top-0 z-30 flex h-14 items-center border-b px-4 backdrop-blur-sm sm:px-6">
          <TopBar />
        </header>
        {/* The bottom padding clears the fixed mobile tab bar — 3.25rem of bar, plus the iOS home
            indicator, plus the page's own gutter. Without it the last row of every list is
            permanently covered. */}
        <main className="flex-1 p-4 pb-[calc(4.25rem+env(safe-area-inset-bottom))] sm:p-6 md:pb-6">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
