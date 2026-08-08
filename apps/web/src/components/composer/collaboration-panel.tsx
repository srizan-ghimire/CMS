"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, History, MessageSquare, RotateCcw, Send, X } from "lucide-react";
import { toast } from "sonner";
import type {
  CommentDto,
  PostApprovalDto,
  PostVersionDto,
} from "@social-platform/shared";
import { apiClient } from "@/lib/api-client";
import { formatRelative } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";

/**
 * Version history, review state and the comment thread for one post. Everything here is
 * server-side truth — the composer's local buffer is deliberately not consulted.
 */
export function CollaborationPanel({
  postId,
  currentUserId,
  canApprove,
  onRestored,
}: {
  postId: string;
  currentUserId: string;
  canApprove: boolean;
  onRestored: () => void;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const versions = useQuery({
    queryKey: ["post-versions", postId],
    queryFn: () => apiClient.get<PostVersionDto[]>(`/posts/${postId}/versions`),
  });
  const approvals = useQuery({
    queryKey: ["post-approvals", postId],
    queryFn: () => apiClient.get<PostApprovalDto[]>(`/posts/${postId}/approvals`),
  });
  const comments = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: () => apiClient.get<CommentDto[]>(`/posts/${postId}/comments`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["post-versions", postId] });
    queryClient.invalidateQueries({ queryKey: ["post-approvals", postId] });
    queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
    queryClient.invalidateQueries({ queryKey: ["post", postId] });
  };

  const restore = useMutation({
    mutationFn: (versionNumber: number) =>
      apiClient.post(`/posts/${postId}/versions/restore`, { versionNumber }),
    onSuccess: () => {
      toast.success("Restored — saved as a new version");
      invalidate();
      onRestored();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not restore"),
  });

  const addComment = useMutation({
    mutationFn: () => apiClient.post(`/posts/${postId}/comments`, { body, mentionedUserIds: [] }),
    onSuccess: () => {
      setBody("");
      invalidate();
    },
  });

  const decide = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "APPROVED" | "REJECTED"; note?: string }) =>
      apiClient.post(`/approvals/${id}/decide`, { decision, note: note ?? null }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["approval-queue"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not record decision"),
  });

  // Only the newest round matters; earlier rounds were invalidated by edits.
  const latestRound = Math.max(0, ...(approvals.data ?? []).map((a) => a.round));
  const currentApprovals = (approvals.data ?? []).filter((a) => a.round === latestRound);
  const mine = currentApprovals.find((a) => a.reviewerId === currentUserId && a.status === "PENDING");

  return (
    <Tabs defaultValue="comments">
      <TabsList>
        <TabsTrigger value="comments" className="gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Comments
          {(comments.data?.length ?? 0) > 0 && (
            <Badge variant="secondary">{comments.data?.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="review" className="gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Review
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-1.5">
          <History className="h-3.5 w-3.5" />
          History
        </TabsTrigger>
      </TabsList>

      {/* ---------------------------------- Comments --------------------------------- */}
      <TabsContent value="comments" className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) addComment.mutate();
          }}
          className="space-y-2"
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave a note for the team"
            className="min-h-[60px]"
          />
          <Button type="submit" size="sm" disabled={!body.trim() || addComment.isPending}>
            <Send className="h-3.5 w-3.5" />
            Comment
          </Button>
        </form>

        {(comments.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.data?.map((comment) => (
              <CommentNode key={comment.id} comment={comment} postId={postId} onChanged={invalidate} />
            ))}
          </ul>
        )}
      </TabsContent>

      {/* ----------------------------------- Review ---------------------------------- */}
      <TabsContent value="review" className="space-y-3">
        {currentApprovals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not in review. Use “Request approval” to send it out.
          </p>
        ) : (
          <ul className="space-y-2">
            {currentApprovals.map((approval) => (
              <li
                key={approval.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{approval.reviewerName}</p>
                  {approval.note && (
                    <p className="truncate text-xs text-muted-foreground">{approval.note}</p>
                  )}
                </div>
                <Badge
                  variant={
                    approval.status === "APPROVED"
                      ? "success"
                      : approval.status === "REJECTED"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {approval.status.toLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {mine && canApprove && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const note = window.prompt("What needs changing?");
                if (note === null) return;
                decide.mutate({ id: mine.id, decision: "REJECTED", note });
              }}
            >
              <X className="h-3.5 w-3.5" />
              Request changes
            </Button>
            <Button size="sm" onClick={() => decide.mutate({ id: mine.id, decision: "APPROVED" })}>
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        )}
      </TabsContent>

      {/* ---------------------------------- History ---------------------------------- */}
      <TabsContent value="history" className="space-y-2">
        {(versions.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No edits recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {versions.data?.map((version) => (
              <li key={version.id} className="rounded-md border border-border p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">v{version.versionNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {version.editedByName ?? "unknown"} · {formatRelative(version.createdAt)}
                  </span>
                </div>
                {version.changeSummary && (
                  <p className="mt-0.5 text-xs italic text-muted-foreground">
                    {version.changeSummary}
                  </p>
                )}
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                  {version.content}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(version.versionNumber)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

function CommentNode({
  comment,
  postId,
  onChanged,
}: {
  comment: CommentDto;
  postId: string;
  onChanged: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState("");

  const reply = useMutation({
    mutationFn: () =>
      apiClient.post(`/posts/${postId}/comments`, {
        body,
        parentId: comment.id,
        mentionedUserIds: [],
      }),
    onSuccess: () => {
      setBody("");
      setReplying(false);
      onChanged();
    },
  });

  const resolve = useMutation({
    mutationFn: () =>
      apiClient.post(`/comments/${comment.id}/${comment.resolvedAt ? "unresolve" : "resolve"}`),
    onSuccess: onChanged,
  });

  return (
    <li className="space-y-1.5">
      <div className="rounded-md border border-border p-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{comment.authorName}</span>
          <span className="text-xs text-muted-foreground">{formatRelative(comment.createdAt)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reply
          </button>
          <button
            type="button"
            onClick={() => resolve.mutate()}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {comment.resolvedAt ? "Reopen" : "Resolve"}
          </button>
          {comment.resolvedAt && <Badge variant="success">resolved</Badge>}
        </div>
      </div>

      {replying && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) reply.mutate();
          }}
          className="ml-4 space-y-1.5"
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[50px]"
            placeholder="Reply…"
          />
          <Button type="submit" size="sm" disabled={!body.trim() || reply.isPending}>
            Reply
          </Button>
        </form>
      )}

      {comment.replies.length > 0 && (
        <ul className="ml-4 space-y-1.5">
          {comment.replies.map((child) => (
            <CommentNode key={child.id} comment={child} postId={postId} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </li>
  );
}
