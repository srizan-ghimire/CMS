"use client";

import { useState } from "react";
import { FolderPlus, Folder, Images } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MediaFolderDto } from "@social-platform/shared";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** `undefined` = every folder, `null` = unfiled only, string = that folder. */
export type FolderSelection = string | null | undefined;

export function FolderTree({
  workspaceId,
  folders,
  selected,
  onSelect,
  canCreate,
}: {
  workspaceId: string;
  folders: MediaFolderDto[];
  selected: FolderSelection;
  onSelect: (selection: FolderSelection) => void;
  canCreate: boolean;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: (folderName: string) =>
      apiClient.post<MediaFolderDto>("/media/folders", {
        workspaceId,
        name: folderName,
        // New folders land at the root; nesting happens by dragging/moving afterwards.
        parentId: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-folders"] });
      setCreating(false);
      setName("");
      toast.success("Folder created");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create folder"),
  });

  return (
    <nav className="space-y-1 text-sm">
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          selected === undefined ? "bg-accent font-medium" : "hover:bg-accent/60",
        )}
      >
        <Images className="h-4 w-4 shrink-0" />
        All media
      </button>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          selected === null ? "bg-accent font-medium" : "hover:bg-accent/60",
        )}
      >
        <Folder className="h-4 w-4 shrink-0" />
        Unfiled
      </button>

      {folders.map((folder) => {
        // Indent by path depth — `path` is materialized server-side, so nesting renders without
        // reconstructing the tree client-side.
        const depth = Math.max(0, folder.path.split("/").filter(Boolean).length - 1);
        return (
          <button
            key={folder.id}
            type="button"
            onClick={() => onSelect(folder.id)}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left transition-colors",
              selected === folder.id ? "bg-accent font-medium" : "hover:bg-accent/60",
            )}
          >
            <Folder className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{folder.assetCount}</span>
          </button>
        );
      })}

      {canCreate &&
        (creating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate(name.trim());
            }}
            className="flex gap-1 pt-1"
          >
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => !name && setCreating(false)}
              placeholder="Folder name"
              className="h-8"
            />
            <Button type="submit" size="sm" disabled={create.isPending || !name.trim()}>
              Add
            </Button>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCreating(true)}
            className="w-full justify-start text-muted-foreground"
          >
            <FolderPlus className="h-4 w-4" />
            New folder
          </Button>
        ))}
    </nav>
  );
}
