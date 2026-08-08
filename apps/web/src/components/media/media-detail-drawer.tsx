"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { MediaAssetDto } from "@social-platform/shared";
import { formatBytes, formatDuration, formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteMedia, useUpdateMedia } from "@/hooks/use-media";

export function MediaDetailDrawer({
  asset,
  onClose,
}: {
  asset: MediaAssetDto | null;
  onClose: () => void;
}) {
  const update = useUpdateMedia();
  const remove = useDeleteMedia();

  const [fileName, setFileName] = useState("");
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!asset) return;
    setFileName(asset.fileName);
    setAltText(asset.altText ?? "");
    setCaption(asset.caption ?? "");
  }, [asset]);

  if (!asset) return null;

  const save = async () => {
    try {
      await update.mutateAsync({
        id: asset.id,
        input: { fileName, altText: altText || null, caption: caption || null },
      });
      toast.success("Saved");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  };

  const del = async () => {
    try {
      await remove.mutateAsync(asset.id);
      toast.success("Deleted");
      onClose();
    } catch (err) {
      // A 409 here means the asset was actually published — surface that verbatim.
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{asset.fileName}</DialogTitle>
          <DialogDescription>
            {formatBytes(asset.sizeBytes)}
            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
            {asset.durationMs ? ` · ${formatDuration(asset.durationMs)}` : ""}
            {` · uploaded ${formatRelative(asset.createdAt)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="overflow-hidden rounded-lg border border-border bg-muted">
            {asset.type === "VIDEO" ? (
              <video src={asset.url} controls className="h-full w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.variants.find((v) => v.label === "preview")?.url ?? asset.url}
                alt={asset.altText ?? asset.fileName}
                className="h-full w-full object-contain"
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fileName">File name</Label>
              <Input id="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="altText">Alt text</Label>
              <Textarea
                id="altText"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the image for screen readers"
                className="min-h-[60px]"
              />
              <p className="text-xs text-muted-foreground">
                Also sent to Instagram and LinkedIn when this asset is published.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Internal note or default caption"
                className="min-h-[60px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={del} disabled={remove.isPending} className="text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
