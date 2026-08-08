"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import type { PostApprovalDto } from "@social-platform/shared";
import { apiClient } from "@/lib/api-client";
import { formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";

export default function ApprovalsPage() {
  const queryClient = useQueryClient();

  // The queue is user-scoped, not workspace-scoped: reviews follow the person across every
  // workspace they belong to.
  const { data, isLoading } = useQuery({
    queryKey: ["approval-queue"],
    queryFn: () => apiClient.get<PostApprovalDto[]>("/approvals/queue"),
  });

  const decide = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "APPROVED" | "REJECTED"; note?: string }) =>
      apiClient.post(`/approvals/${id}/decide`, { decision, note: note ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-queue"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not record decision"),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Posts waiting on your review.</p>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          Nothing waiting on you.
        </div>
      ) : (
        <ul className="space-y-2">
          {data?.map((approval) => (
            <li
              key={approval.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/composer?id=${approval.postId}`}
                  className="font-medium hover:underline"
                >
                  Review requested
                </Link>
                <p className="text-xs text-muted-foreground">
                  round {approval.round} · asked {formatRelative(approval.createdAt)}
                </p>
                {approval.note && <p className="mt-1 text-sm">{approval.note}</p>}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => {
                    const note = window.prompt("What needs changing?") ?? undefined;
                    // A null return means the reviewer cancelled the dialog, not that they
                    // rejected with an empty note.
                    if (note === undefined) return;
                    decide.mutate({ id: approval.id, decision: "REJECTED", note });
                  }}
                >
                  <X className="h-4 w-4" />
                  Request changes
                </Button>
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: approval.id, decision: "APPROVED" })}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
