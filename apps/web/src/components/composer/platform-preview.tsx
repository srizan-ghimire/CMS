"use client";

import { Heart, MessageCircle, MoreHorizontal, Repeat2, Send } from "lucide-react";
import type { MediaAssetDto, SocialPlatform } from "@social-platform/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/misc";
import { platformLabel } from "./platform-icon";

/** Approximate rendering of how the post will appear. Deliberately schematic — the point is to
 *  catch truncation, missing media and empty captions, not to be pixel-accurate. */
export function PlatformPreview({
  platform,
  accountName,
  accountHandle,
  accountAvatarUrl,
  content,
  media,
}: {
  platform: SocialPlatform;
  accountName: string;
  accountHandle: string | null;
  accountAvatarUrl: string | null;
  content: string;
  media: MediaAssetDto[];
}) {
  const images = media.slice(0, 4);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 p-3">
        <Avatar className="h-8 w-8">
          {accountAvatarUrl && <AvatarImage src={accountAvatarUrl} alt="" />}
          <AvatarFallback>{accountName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{accountName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {accountHandle ? `@${accountHandle}` : platformLabel(platform)} · now
          </p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </div>

      {content ? (
        <p className="whitespace-pre-wrap px-3 pb-3 text-sm">{content}</p>
      ) : (
        <p className="px-3 pb-3 text-sm italic text-muted-foreground">No caption yet</p>
      )}

      {images.length > 0 && (
        <div
          className={
            images.length === 1
              ? "grid grid-cols-1"
              : images.length === 2
                ? "grid grid-cols-2 gap-0.5"
                : "grid grid-cols-2 gap-0.5"
          }
        >
          {images.map((asset) => (
            <div key={asset.id} className="aspect-square overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.variants.find((v) => v.label === "preview")?.url ?? asset.thumbnailUrl ?? asset.url}
                alt={asset.altText ?? asset.fileName}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-5 px-3 py-2 text-muted-foreground">
        <Heart className="h-4 w-4" />
        <MessageCircle className="h-4 w-4" />
        {platform === "TWITTER" ? <Repeat2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
      </div>
    </div>
  );
}
