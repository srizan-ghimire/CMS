"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { toast } from "sonner";
import type { PostStatus, PostTargetStatus } from "@social-platform/shared";
import { apiClient, toQuery } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { roleAtLeast, useActiveWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CalendarEntry {
  postId: string;
  title: string;
  status: PostStatus;
  scheduledAt: string;
  timezone: string;
  targets: {
    id: string;
    platform: string;
    accountName: string;
    status: PostTargetStatus;
    errorMessage: string | null;
    attempts: number;
    nextAttemptAt: string | null;
    permalink: string | null;
  }[];
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_APPROVAL: "bg-warning/20 text-warning",
  SCHEDULED: "bg-primary/15 text-primary",
  PUBLISHING: "bg-warning/20 text-warning",
  PUBLISHED: "bg-success/15 text-success",
  PARTIALLY_PUBLISHED: "bg-warning/20 text-warning",
  FAILED: "bg-destructive/15 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground line-through",
};

/** Days in a month grid, padded to whole weeks starting Monday. */
function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  const weekday = (first.getDay() + 6) % 7; // Monday = 0
  start.setDate(first.getDate() - weekday);

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { workspaceId, role, isLoading } = useActiveWorkspace();
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [dragging, setDragging] = useState<CalendarEntry | null>(null);

  const canSchedule = roleAtLeast(role, "MANAGER");
  const days = useMemo(() => monthGrid(anchor), [anchor]);
  const from = days[0]!;
  const to = days[days.length - 1]!;

  const { data: entries } = useQuery({
    queryKey: ["calendar", workspaceId, from.toISOString(), to.toISOString()],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      apiClient.get<CalendarEntry[]>(
        `/scheduling/calendar${toQuery({
          workspaceId,
          from: from.toISOString(),
          to: new Date(to.getTime() + 86_400_000).toISOString(),
        })}`,
      ),
    // Anything mid-publish changes state on its own, so keep the grid live while it does.
    refetchInterval: (query) =>
      query.state.data?.some((e) => e.status === "PUBLISHING") ? 3000 : false,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries ?? []) {
      const key = new Date(entry.scheduledAt).toDateString();
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    }
    return map;
  }, [entries]);

  const drop = async (day: Date) => {
    if (!dragging || !canSchedule) return;
    // Move the date but keep the time-of-day: dragging across the grid is a day-level gesture,
    // and silently resetting the hour would surprise the user.
    const original = new Date(dragging.scheduledAt);
    const next = new Date(day);
    next.setHours(original.getHours(), original.getMinutes(), 0, 0);

    try {
      await apiClient.patch(`/scheduling/posts/${dragging.postId}/schedule`, {
        scheduledAt: next.toISOString(),
      });
      toast.success("Rescheduled");
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reschedule");
    } finally {
      setDragging(null);
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!workspaceId) {
    return <p className="text-sm text-muted-foreground">Create a workspace to see the calendar.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything scheduled, with live publish status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[150px] text-center text-sm font-medium">
            {anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px] border-l border-t border-border">
          <div className="grid grid-cols-7">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
              <div
                key={label}
                className="border-b border-r border-border px-2 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const inMonth = day.getMonth() === anchor.getMonth();
              const isToday = sameDay(day, new Date());
              const dayEntries = byDay.get(day.toDateString()) ?? [];

              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => canSchedule && e.preventDefault()}
                  onDrop={() => void drop(day)}
                  className={cn(
                    "min-h-[104px] border-b border-r border-border p-1.5",
                    !inMonth && "bg-muted/30",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      isToday
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {day.getDate()}
                  </div>

                  <div className="space-y-1">
                    {dayEntries.map((entry) => (
                      <button
                        key={entry.postId}
                        type="button"
                        draggable={canSchedule && entry.status !== "PUBLISHED"}
                        onDragStart={() => setDragging(entry)}
                        onClick={() => setSelected(entry)}
                        className={cn(
                          "block w-full truncate rounded px-1.5 py-1 text-left text-[11px]",
                          STATUS_COLOR[entry.status] ?? "bg-muted",
                        )}
                        title={`${entry.title} · ${new Date(entry.scheduledAt).toLocaleTimeString()}`}
                      >
                        {new Date(entry.scheduledAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        {entry.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <PublishLogDialog
        entry={selected}
        onClose={() => setSelected(null)}
        canRetry={canSchedule}
        onRetried={() => queryClient.invalidateQueries({ queryKey: ["calendar"] })}
      />
    </div>
  );
}

/** Per-target publish log: what happened on each platform, and a way to retry what failed. */
function PublishLogDialog({
  entry,
  onClose,
  canRetry,
  onRetried,
}: {
  entry: CalendarEntry | null;
  onClose: () => void;
  canRetry: boolean;
  onRetried: () => void;
}) {
  if (!entry) return null;

  const retry = async (targetId: string) => {
    try {
      await apiClient.post(`/posts/targets/${targetId}/retry`);
      toast.success("Retry queued");
      onRetried();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">{entry.title}</DialogTitle>
          <DialogDescription>
            {new Date(entry.scheduledAt).toLocaleString()} · {entry.timezone}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {entry.targets.map((target) => (
            <li key={target.id} className="rounded-md border border-border p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{target.accountName}</span>
                <Badge
                  variant={
                    target.status === "PUBLISHED"
                      ? "success"
                      : target.status === "FAILED"
                        ? "destructive"
                        : target.status === "SKIPPED"
                          ? "outline"
                          : "secondary"
                  }
                >
                  {target.status.toLowerCase()}
                </Badge>
              </div>

              {target.errorMessage && (
                <p className="mt-1 text-xs text-destructive">{target.errorMessage}</p>
              )}
              {target.attempts > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {target.attempts} attempt{target.attempts === 1 ? "" : "s"}
                  {target.nextAttemptAt
                    ? ` · next ${new Date(target.nextAttemptAt).toLocaleTimeString()}`
                    : ""}
                </p>
              )}
              {target.permalink && (
                <a
                  href={target.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-primary hover:underline"
                >
                  View post
                </a>
              )}

              {canRetry && (target.status === "FAILED" || target.status === "SKIPPED") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => retry(target.id)}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              )}
            </li>
          ))}
        </ul>

        <Link href={`/composer?id=${entry.postId}`} className="text-sm text-primary hover:underline">
          Open in composer
        </Link>
      </DialogContent>
    </Dialog>
  );
}
