"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { ACCEPTED_MIME_TYPES } from "@social-platform/shared";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UploadItem } from "@/hooks/use-media";

const ACCEPT = Object.keys(ACCEPTED_MIME_TYPES).join(",");

export function MediaUploader({
  uploads,
  onUpload,
  onClearCompleted,
  disabled,
}: {
  uploads: UploadItem[];
  onUpload: (files: File[]) => void;
  onClearCompleted: () => void;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onUpload(files);
    },
    [onUpload, disabled],
  );

  const active = uploads.filter((u) => u.status !== "done");
  const completed = uploads.filter((u) => u.status === "done").length;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <UploadCloud className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm font-medium">Drop files here</p>
        <p className="text-xs text-muted-foreground">
          Images, video and PDF. Uploads go straight to storage.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) onUpload(files);
            // Reset so selecting the same file twice in a row still fires onChange.
            e.target.value = "";
          }}
        />
      </div>

      {(active.length > 0 || completed > 0) && (
        <div className="space-y-1.5 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {active.length > 0 ? `${active.length} in progress` : `${completed} uploaded`}
            </span>
            {completed > 0 && (
              <button type="button" onClick={onClearCompleted} className="hover:text-foreground">
                Clear finished
              </button>
            )}
          </div>

          {uploads.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <span className="w-5 shrink-0">
                {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-success" />}
                {item.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                {(item.status === "uploading" || item.status === "processing") && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </span>

              <span className="min-w-0 flex-1 truncate">{item.file.name}</span>

              <span className="shrink-0 text-xs text-muted-foreground">
                {item.status === "error"
                  ? item.error
                  : item.status === "processing"
                    ? "Processing…"
                    : item.status === "done"
                      ? formatBytes(item.file.size)
                      : `${Math.round(item.progress * 100)}%`}
              </span>

              {item.status === "uploading" && (
                <span className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full bg-primary transition-all"
                    style={{ width: `${item.progress * 100}%` }}
                  />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
