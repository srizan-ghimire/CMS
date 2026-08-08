"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MediaAssetDto,
  MediaFolderDto,
  PresignUploadResponse,
  UpdateMediaInput,
} from "@social-platform/shared";
import { apiClient, toQuery, uploadToPresignedUrl } from "@/lib/api-client";

export interface MediaListFilters {
  folderId?: string | null;
  type?: string;
  search?: string;
  isFavorite?: boolean;
}

export function useMediaList(workspaceId: string | null, filters: MediaListFilters = {}) {
  return useQuery({
    queryKey: ["media", workspaceId, filters],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      apiClient.get<{ items: MediaAssetDto[]; nextCursor: string | null }>(
        `/media${toQuery({
          workspaceId,
          scope: filters.folderId === undefined ? "all" : filters.folderId === null ? "root" : "folder",
          folderId: filters.folderId ?? undefined,
          type: filters.type,
          search: filters.search,
          isFavorite: filters.isFavorite,
        })}`,
      ),
    // Assets are PROCESSING for a second or two after upload; poll until none are in flight so
    // thumbnails appear without the user refreshing.
    refetchInterval: (query) =>
      query.state.data?.items.some((a) => a.status === "PROCESSING" || a.status === "UPLOADING")
        ? 2000
        : false,
  });
}

export function useMediaFolders(workspaceId: string | null) {
  return useQuery({
    queryKey: ["media-folders", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiClient.get<MediaFolderDto[]>(`/media/folders${toQuery({ workspaceId })}`),
  });
}

export function useUpdateMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMediaInput }) =>
      apiClient.patch<MediaAssetDto>(`/media/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/media/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }),
  });
}

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  error?: string;
}

/** Files above this size skip checksum dedupe — hashing a 1GB video in the main thread would
 *  freeze the tab, and dedupe matters most for small, repeatedly-reused brand assets. */
const CHECKSUM_MAX_BYTES = 50 * 1024 * 1024;

async function sha256Hex(file: File): Promise<string | undefined> {
  if (file.size > CHECKSUM_MAX_BYTES || !globalThis.crypto?.subtle) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Reads intrinsic dimensions client-side. For video this is the only source we have — the API
 * deliberately doesn't run ffmpeg — and it also yields a poster frame for the thumbnail.
 */
async function probeMedia(
  file: File,
): Promise<{ width?: number; height?: number; durationMs?: number; poster?: Blob }> {
  if (file.type.startsWith("image/")) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      img.src = url;
    });
  }

  if (file.type.startsWith("video/")) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);
      video.preload = "metadata";
      video.muted = true;

      const finish = (result: { width?: number; height?: number; durationMs?: number; poster?: Blob }) => {
        URL.revokeObjectURL(url);
        resolve(result);
      };

      video.onloadeddata = () => {
        const base = {
          width: video.videoWidth,
          height: video.videoHeight,
          durationMs: Math.round(video.duration * 1000),
        };
        // Seek a little way in — frame 0 of most videos is a black or blank frame.
        video.currentTime = Math.min(1, video.duration / 2);
        video.onseeked = () => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d")?.drawImage(video, 0, 0);
          canvas.toBlob((blob) => finish({ ...base, poster: blob ?? undefined }), "image/jpeg", 0.8);
        };
      };
      video.onerror = () => finish({});
      video.src = url;
    });
  }

  return {};
}

/**
 * Drives the 3-hop upload: presign -> PUT direct to storage -> finalize. Bytes never touch the
 * API, which is both faster and necessary given `bodyParser: false` on the Nest side.
 */
export function useMediaUpload(workspaceId: string | null, folderId?: string | null) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setUploads((current) => current.map((u) => (u.id === id ? { ...u, ...changes } : u)));
  }, []);

  const upload = useCallback(
    async (files: File[]) => {
      if (!workspaceId) return;

      const items: UploadItem[] = files.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: "pending",
      }));
      setUploads((current) => [...current, ...items]);

      for (const item of items) {
        try {
          patch(item.id, { status: "uploading" });

          const [checksum, probe] = await Promise.all([sha256Hex(item.file), probeMedia(item.file)]);

          const presigned = await apiClient.post<PresignUploadResponse>("/media/uploads/presign", {
            workspaceId,
            fileName: item.file.name,
            mimeType: item.file.type,
            sizeBytes: item.file.size,
            folderId: folderId ?? null,
            checksum,
          });

          // Identical bytes already in this workspace — reuse the asset, skip the transfer.
          if (presigned.duplicateOf) {
            patch(item.id, { status: "done", progress: 1 });
            continue;
          }

          await uploadToPresignedUrl(presigned.uploadUrl, item.file, {
            contentType: item.file.type,
            onProgress: (fraction) => patch(item.id, { progress: fraction }),
          });

          // A video poster needs its own presign+PUT, since it's a second object.
          let posterStorageKey: string | undefined;
          if (probe.poster) {
            const posterPresign = await apiClient.post<PresignUploadResponse>(
              "/media/uploads/presign",
              {
                workspaceId,
                fileName: `${item.file.name}.poster.jpg`,
                mimeType: "image/jpeg",
                sizeBytes: probe.poster.size,
                folderId: folderId ?? null,
              },
            );
            await uploadToPresignedUrl(posterPresign.uploadUrl, probe.poster, {
              contentType: "image/jpeg",
            });
            posterStorageKey = posterPresign.storageKey;
          }

          patch(item.id, { status: "processing", progress: 1 });
          await apiClient.post(`/media/${presigned.assetId}/finalize`, {
            width: probe.width ?? null,
            height: probe.height ?? null,
            durationMs: probe.durationMs ?? null,
            posterStorageKey: posterStorageKey ?? null,
          });

          patch(item.id, { status: "done" });
        } catch (err) {
          patch(item.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    [workspaceId, folderId, patch, queryClient],
  );

  const clearCompleted = useCallback(
    () => setUploads((current) => current.filter((u) => u.status !== "done")),
    [],
  );

  return { uploads, upload, clearCompleted };
}
