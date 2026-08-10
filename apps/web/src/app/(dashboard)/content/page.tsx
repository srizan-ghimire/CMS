"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Copy, MoreHorizontal, PenSquare, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PostStatus, type PostDto } from "@social-platform/shared";
import { cn, formatRelative } from "@/lib/utils";
import { roleAtLeast, useActiveWorkspace } from "@/hooks/use-workspace";
import { useDeletePost, usePostAction, usePosts } from "@/hooks/use-posts";
import { PlatformIcon } from "@/components/composer/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "warning",
  SCHEDULED: "default",
  PUBLISHING: "warning",
  PUBLISHED: "success",
  PARTIALLY_PUBLISHED: "warning",
  FAILED: "destructive",
  CANCELLED: "outline",
};

export default function ContentPage() {
  const { workspaceId, role, isLoading: workspaceLoading } = useActiveWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [includeArchived, setIncludeArchived] = useState(false);

  const canEdit = roleAtLeast(role, "EDITOR");
  const { data, isLoading } = usePosts(workspaceId, {
    search: search || undefined,
    status: status === "all" ? undefined : [status],
    includeArchived,
  });

  const action = usePostAction();
  const del = useDeletePost();

  const run = async (fn: Promise<unknown>, message: string) => {
    try {
      await fn;
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  if (workspaceLoading) return <Skeleton className="h-64 w-full" />;
  if (!workspaceId) {
    return <p className="text-muted-foreground text-sm">Create a workspace to manage content.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">All content</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every draft, scheduled and published post in this workspace.
          </p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href="/composer">
              <PenSquare className="h-4 w-4" />
              New post
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:min-w-[220px] sm:flex-1">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles and captions"
            className="pl-8"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(PostStatus).map((value) => (
              <SelectItem key={value} value={value}>
                {value.replace("_", " ").toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={includeArchived ? "default" : "outline"}
          onClick={() => setIncludeArchived((v) => !v)}
          aria-pressed={includeArchived}
        >
          <Archive className="h-4 w-4" />
          Archived
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="border-border text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
          {search || status !== "all" ? "Nothing matches these filters." : "No posts yet."}
        </div>
      ) : (
        <ul className="space-y-2">
          {data?.items.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              canEdit={canEdit}
              onDuplicate={() =>
                run(action.mutateAsync({ id: post.id, action: "duplicate" }), "Duplicated")
              }
              onArchive={() =>
                run(
                  action.mutateAsync({
                    id: post.id,
                    action: post.archivedAt ? "unarchive" : "archive",
                  }),
                  post.archivedAt ? "Unarchived" : "Archived",
                )
              }
              onDelete={() => run(del.mutateAsync(post.id), "Deleted")}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PostRow({
  post,
  canEdit,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  post: PostDto;
  canEdit: boolean;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const preview = post.content.trim().split("\n")[0] ?? "";

  return (
    <li className="border-border flex items-start gap-3 rounded-lg border p-3">
      {post.media[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.media[0].variants.find((v) => v.label === "thumb")?.url ?? post.media[0].url}
          alt=""
          className="h-14 w-14 shrink-0 rounded object-cover"
        />
      )}

      <div className="min-w-0 flex-1">
        <Link href={`/composer?id=${post.id}`} className="block">
          <p className={cn("truncate font-medium", !post.title && "text-muted-foreground")}>
            {post.title || preview || "Untitled draft"}
          </p>
          {post.title && preview && (
            <p className="text-muted-foreground truncate text-sm">{preview}</p>
          )}
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[post.status] ?? "secondary"}>
            {post.status.replace("_", " ").toLowerCase()}
          </Badge>
          {post.archivedAt && <Badge variant="outline">archived</Badge>}
          <span className="flex items-center gap-1">
            {post.targets.map((target) => (
              <PlatformIcon
                key={target.id}
                platform={target.platform}
                className="text-muted-foreground h-3.5 w-3.5"
              />
            ))}
          </span>
          <span className="text-muted-foreground text-xs">
            {post.scheduledAt
              ? `scheduled ${formatRelative(post.scheduledAt)}`
              : `edited ${formatRelative(post.updatedAt)}`}
          </span>
        </div>
      </div>

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Post actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy className="h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onArchive}>
              <Archive className="h-4 w-4" />
              {post.archivedAt ? "Unarchive" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={onDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
