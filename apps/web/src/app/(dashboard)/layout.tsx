import type { ReactNode } from "react";
import { TopBar } from "@/components/dashboard/top-bar";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/40 md:block">
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border px-6">
          <TopBar />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
