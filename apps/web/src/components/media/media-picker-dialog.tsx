"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { MediaAssetDto } from "@social-platform/shared";
import { useMediaList, useMediaUpload } from "@/hooks/use-media";
import { MediaGrid } from "./media-grid";
import { MediaUploader } from "./media-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Pick existing assets, or upload new ones without leaving the dialog. Built here in Stage 1 so
 * the composer can consume it unchanged in Stage 2.
 */
export function MediaPickerDialog({
  workspaceId,
  open,
  onOpenChange,
  onConfirm,
  alreadySelectedIds = [],
  maxSelectable,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (assets: MediaAssetDto[]) => void;
  alreadySelectedIds?: string[];
  maxSelectable?: number;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, MediaAssetDto>>(new Map());

  const { data, isLoading } = useMediaList(workspaceId, { search: search || undefined });
  const { uploads, upload, clearCompleted } = useMediaUpload(workspaceId);

  // Assets already attached to the post are not offered again.
  const available = (data?.items ?? []).filter(
    (asset) => asset.status === "READY" && !alreadySelectedIds.includes(asset.id),
  );

  const atLimit = maxSelectable !== undefined && selected.size >= maxSelectable;

  const toggle = (asset: MediaAssetDto) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(asset.id)) next.delete(asset.id);
      else if (!atLimit) next.set(asset.id, asset);
      return next;
    });
  };

  const confirm = () => {
    onConfirm(Array.from(selected.values()));
    setSelected(new Map());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add media</DialogTitle>
          <DialogDescription>
            {maxSelectable !== undefined
              ? `Select up to ${maxSelectable} item${maxSelectable === 1 ? "" : "s"}.`
              : "Select from the library or upload something new."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search media"
                className="pl-8"
              />
            </div>

            <div className="max-h-[45vh] overflow-y-auto pr-1">
              {isLoading ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full" />
                  ))}
                </div>
              ) : (
                <MediaGrid
                  assets={available}
                  selectedIds={new Set(selected.keys())}
                  onToggleSelect={(id) => {
                    const asset = available.find((a) => a.id === id);
                    if (asset) toggle(asset);
                  }}
                  onOpen={toggle}
                  emptyMessage="Nothing available. Upload something on the next tab."
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <MediaUploader uploads={uploads} onUpload={upload} onClearCompleted={clearCompleted} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="sm:justify-between">
          <span className="self-center text-sm text-muted-foreground">
            {selected.size} selected
            {atLimit ? " (limit reached)" : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={selected.size === 0}>
              Add {selected.size > 0 ? selected.size : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
