"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Send, Users } from "lucide-react";
import { toast } from "sonner";
import type { PostDto } from "@social-platform/shared";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Terminal actions on a draft. All three are disabled while validation is failing — the server
 * would refuse anyway, and letting the user click through to a queue failure is worse than not
 * offering the button.
 */
export function ComposerActions({
  post,
  hasBlockingErrors,
  canPublish,
  onSaveFirst,
  onChanged,
}: {
  post: PostDto | null;
  hasBlockingErrors: boolean;
  canPublish: boolean;
  onSaveFirst: () => Promise<PostDto | null>;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState(false);

  const hasTargets = (post?.targets.length ?? 0) > 0;
  const disabled = busy || hasBlockingErrors || !hasTargets;
  // The API requires MANAGER+ to schedule or publish (PUBLISH_ROLES). An EDITOR can still send a
  // post for review, which is the intended path for them. This only hides controls the server
  // would reject — it is never the authorization boundary.
  const publishDisabled = disabled || !canPublish;

  /** Every action saves first: the composer autosaves on a debounce, so the newest keystrokes
   *  may not have reached the server yet. */
  const withSavedPost = async (fn: (saved: PostDto) => Promise<void>) => {
    setBusy(true);
    try {
      const saved = await onSaveFirst();
      if (!saved) return;
      await fn(saved);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const publishNow = () =>
    withSavedPost(async (saved) => {
      const result = await apiClient.post<{ queued: number; skipped: number }>(
        `/posts/${saved.id}/publish`,
        { publishNow: true },
      );
      // Report skips explicitly — "published" alone would hide that a platform was left out.
      toast.success(
        result.skipped > 0
          ? `Publishing to ${result.queued} account(s); ${result.skipped} skipped`
          : `Publishing to ${result.queued} account(s)`,
      );
      router.push("/content");
    });

  const schedule = () =>
    withSavedPost(async (saved) => {
      const when = new Date(scheduleAt);
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        toast.error("Pick a time in the future.");
        return;
      }
      await apiClient.patch(`/posts/${saved.id}`, { scheduledAt: when.toISOString() });
      await apiClient.post(`/posts/${saved.id}/publish`, { publishNow: false });
      toast.success(`Scheduled for ${when.toLocaleString()}`);
      setScheduleOpen(false);
      router.push("/calendar");
    });

  const requestApproval = () =>
    withSavedPost(async (saved) => {
      await apiClient.post(`/posts/${saved.id}/request-approval`, {});
      toast.success("Sent for review");
      router.push("/content");
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={requestApproval} disabled={disabled}>
        <Users className="h-4 w-4" />
        Request approval
      </Button>

      <Button
        variant="outline"
        onClick={() => setScheduleOpen(true)}
        disabled={publishDisabled}
        title={!canPublish ? "Scheduling requires the Manager role" : undefined}
      >
        <CalendarClock className="h-4 w-4" />
        Schedule
      </Button>

      <Button
        onClick={publishNow}
        disabled={publishDisabled}
        title={!canPublish ? "Publishing requires the Manager role" : undefined}
      >
        <Send className="h-4 w-4" />
        Publish now
      </Button>

      {!hasTargets && (
        <span className="text-xs text-muted-foreground">Select at least one account.</span>
      )}
      {hasTargets && !canPublish && (
        <span className="text-xs text-muted-foreground">
          Send for review — publishing needs a Manager.
        </span>
      )}

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule this post</DialogTitle>
            <DialogDescription>
              Times use this browser&apos;s timezone and are stored as an absolute instant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="scheduledAt">Publish at</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={schedule} disabled={busy || !scheduleAt}>
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
