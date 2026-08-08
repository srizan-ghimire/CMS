"use client";

import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { NotificationBell } from "./notification-bell";

export function TopBar() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const onSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <div className="flex w-full items-center justify-between">
      <span className="text-sm font-medium md:hidden">Social Platform</span>
      <div className="ml-auto flex items-center gap-3">
        {!isPending && session?.user && (
          <>
            <NotificationBell />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session.user.email}
            </span>
            <button onClick={onSignOut} className="text-sm text-primary hover:underline">
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
