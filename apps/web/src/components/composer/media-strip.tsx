"use client";

import { ArrowLeft, ArrowRight, ImagePlus, X } from "lucide-react";
import type { MediaAssetDto } from "@social-platform/shared";
import { Button } from "@/components/ui/button";

/** Attached media in publish order, with reordering — carousel sequence is user-visible output. */
export function MediaStrip({
  assets,
  onAdd,
  onRemove,
  onReorder,
  disabled,
}: {
  assets: MediaAssetDto[];
  onAdd: () => void;
  onRemove: (assetId: string) => void;
  onReorder: (from: number, to: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {assets.map((asset, index) => (
        <div
          key={asset.id}
          className="group relative h-20 w-20 overflow-hidden rounded-md border border-border bg-muted"
        >
          {asset.type === "VIDEO" && !asset.thumbnailUrl ? (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
              Video
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.variants.find((v) => v.label === "thumb")?.url ?? asset.thumbnailUrl ?? asset.url}
              alt={asset.altText ?? asset.fileName}
              className="h-full w-full object-cover"
            />
          )}

          {!disabled && (
            <>
              <button
                type="button"
                onClick={() => onRemove(asset.id)}
                aria-label={`Remove ${asset.fileName}`}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onReorder(index, index - 1)}
                  aria-label="Move earlier"
                  className="p-0.5 text-white disabled:opacity-30"
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
                <span className="px-1 text-[10px] font-medium text-white">{index + 1}</span>
                <button
                  type="button"
                  disabled={index === assets.length - 1}
                  onClick={() => onReorder(index, index + 1)}
                  aria-label="Move later"
                  className="p-0.5 text-white disabled:opacity-30"
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {!disabled && (
        <Button type="button" variant="outline" onClick={onAdd} className="h-20 w-20 flex-col gap-1">
          <ImagePlus className="h-5 w-5" />
          <span className="text-[11px]">Add</span>
        </Button>
      )}
    </div>
  );
}
