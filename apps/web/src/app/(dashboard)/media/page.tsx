"use client";

import { useState } from "react";
import { Search, Star, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { MediaAssetDto } from "@social-platform/shared";
import { apiClient } from "@/lib/api-client";
import { roleAtLeast, useActiveWorkspace } from "@/hooks/use-workspace";
import { useMediaFolders, useMediaList, useMediaUpload } from "@/hooks/use-media";
import { MediaUploader } from "@/components/media/media-uploader";
import { MediaGrid } from "@/components/media/media-grid";
import { MediaDetailDrawer } from "@/components/media/media-detail-drawer";
import { FolderTree, type FolderSelection } from "@/components/media/folder-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function MediaPage() {
  const queryClient = useQueryClient();
  const { workspaceId, role, isLoading: workspaceLoading } = useActiveWorkspace();

  const [folder, setFolder] = useState<FolderSelection>(undefined);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openAsset, setOpenAsset] = useState<MediaAssetDto | null>(null);

  const canEdit = roleAtLeast(role, "EDITOR");
  const canManage = roleAtLeast(role, "MANAGER");

  const { data: folders } = useMediaFolders(workspaceId);
  const { data, isLoading } = useMediaList(workspaceId, {
    folderId: folder,
    search: search || undefined,
    type: type === "all" ? undefined : type,
    isFavorite: favouritesOnly || undefined,
  });
  const { uploads, upload, clearCompleted } = useMediaUpload(
    workspaceId,
    typeof folder === "string" ? folder : null,
  );

  const toggleSelect = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = async (action: "delete" | "favorite" | "unfavorite") => {
    if (!workspaceId || selectedIds.size === 0) return;
    try {
      const result = await apiClient.post<{ affected: number; skipped: number }>("/media/bulk", {
        workspaceId,
        assetIds: Array.from(selectedIds),
        action,
      });
      // Report skips explicitly — silently dropping published assets from a delete would look
      // like the action simply worked.
      toast.success(
        result.skipped > 0
          ? `${result.affected} updated, ${result.skipped} skipped (published assets can't be deleted)`
          : `${result.affected} updated`,
      );
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["media"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed");
    }
  };

  if (workspaceLoading) return <Skeleton className="h-64 w-full" />;

  if (!workspaceId) {
    return (
      <p className="text-muted-foreground text-sm">
        You don&apos;t have a workspace yet. Create one to start uploading media.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Media library</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Reusable images, video and documents for this workspace.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside>
          <FolderTree
            workspaceId={workspaceId}
            folders={folders ?? []}
            selected={folder}
            onSelect={setFolder}
            canCreate={canEdit}
          />
        </aside>

        <div className="min-w-0 space-y-4">
          {canEdit && (
            <MediaUploader uploads={uploads} onUpload={upload} onClearCompleted={clearCompleted} />
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:min-w-[200px] sm:flex-1">
              <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search file name, alt text or caption"
                className="pl-8"
              />
            </div>

            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="IMAGE">Images</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
                <SelectItem value="DOCUMENT">Documents</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={favouritesOnly ? "default" : "outline"}
              size="icon"
              onClick={() => setFavouritesOnly((v) => !v)}
              aria-pressed={favouritesOnly}
              aria-label="Show favourites only"
            >
              <Star className="h-4 w-4" />
            </Button>
          </div>

          {selectedIds.size > 0 && (
            <div className="border-border bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="font-medium">{selectedIds.size} selected</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => runBulk("favorite")}>
                  Favourite
                </Button>
                <Button size="sm" variant="outline" onClick={() => runBulk("unfavorite")}>
                  Unfavourite
                </Button>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => runBulk("delete")}>
                    Delete
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          ) : (
            <MediaGrid
              assets={data?.items ?? []}
              selectedIds={selectedIds}
              onToggleSelect={canEdit ? toggleSelect : undefined}
              onOpen={setOpenAsset}
              emptyMessage={
                search || favouritesOnly || type !== "all"
                  ? "Nothing matches these filters."
                  : "No media yet. Drop a file above to get started."
              }
            />
          )}
        </div>
      </div>

      <MediaDetailDrawer asset={openAsset} onClose={() => setOpenAsset(null)} />
    </div>
  );
}
