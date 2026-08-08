"use client";

import { AlertCircle, FileText, Film, Loader2, Star } from "lucide-react";
import type { MediaAssetDto } from "@social-platform/shared";
import { cn, formatBytes, formatDuration } from "@/lib/utils";
import { Checkbox } from "@/components/ui/misc";

function AssetPreview({ asset }: { asset: MediaAssetDto }) {
  if (asset.status === "PROCESSING" || asset.status === "UPLOADING") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-[11px]">
          {asset.status === "UPLOADING" ? "Uploading" : "Processing"}
        </span>
      </div>
    );
  }

  if (asset.status === "FAILED") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-destructive/10 px-2 text-center text-destructive">
        <AlertCircle className="h-5 w-5" />
        <span className="line-clamp-2 text-[11px]">{asset.processingError ?? "Failed"}</span>
      </div>
    );
  }

  if (asset.type === "DOCUMENT") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
        <FileText className="h-7 w-7" />
      </div>
    );
  }

  const src = asset.variants.find((v) => v.label === "thumb")?.url ?? asset.thumbnailUrl ?? asset.url;

  return (
    <>
      {/* Plain <img>: these are user-uploaded assets on an arbitrary storage origin, and
          next/image would need every possible MinIO/S3/CDN host in remotePatterns. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={asset.altText ?? asset.fileName}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      {asset.type === "VIDEO" && (
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          <Film className="h-3 w-3" />
          {asset.durationMs ? formatDuration(asset.durationMs) : "Video"}
        </span>
      )}
    </>
  );
}

export function MediaGrid({
  assets,
  selectedIds,
  onToggleSelect,
  onOpen,
  emptyMessage = "No media yet. Upload something to get started.",
}: {
  assets: MediaAssetDto[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onOpen?: (asset: MediaAssetDto) => void;
  emptyMessage?: string;
}) {
  if (assets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {assets.map((asset) => {
        const selected = selectedIds?.has(asset.id) ?? false;
        return (
          <li key={asset.id}>
            <div
              className={cn(
                "group relative overflow-hidden rounded-lg border transition-colors",
                selected ? "border-primary ring-2 ring-primary/30" : "border-border",
              )}
            >
              <button
                type="button"
                onClick={() => onOpen?.(asset)}
                className="relative block aspect-square w-full overflow-hidden bg-muted"
                aria-label={`Open ${asset.fileName}`}
              >
                <AssetPreview asset={asset} />
              </button>

              {onToggleSelect && (
                <div
                  className={cn(
                    "absolute left-2 top-2 transition-opacity",
                    selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(asset.id)}
                    aria-label={`Select ${asset.fileName}`}
                    className="bg-background"
                  />
                </div>
              )}

              {asset.isFavorite && (
                <Star className="absolute right-2 top-2 h-4 w-4 fill-warning text-warning" />
              )}

              <div className="space-y-0.5 p-2">
                <p className="truncate text-xs font-medium" title={asset.fileName}>
                  {asset.fileName}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>{formatBytes(asset.sizeBytes)}</span>
                  {asset.width && asset.height && (
                    <span>
                      · {asset.width}×{asset.height}
                    </span>
                  )}
                  {/* Missing alt text is a publish-time failure for some platforms, so surface
                      it in the grid rather than only in the detail drawer. */}
                  {asset.type === "IMAGE" && !asset.altText && (
                    <span className="text-warning">· no alt</span>
                  )}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
