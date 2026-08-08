"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn, formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      apiClient.get<{ items: NotificationDto[]; unreadCount: number }>("/notifications"),
    // Polled rather than pushed: these are low-frequency events and polling avoids a socket's
    // reconnect/auth edge cases for no user-visible difference at this volume.
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiClient.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => apiClient.post("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {(data?.items.length ?? 0) === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            data?.items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => !notification.readAt && markRead.mutate(notification.id)}
                className={cn(
                  "block w-full border-b border-border px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-accent",
                  !notification.readAt && "bg-primary/5",
                )}
              >
                <div className="flex items-start gap-2">
                  {!notification.readAt && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{notification.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRelative(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
