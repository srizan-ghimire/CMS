// Inlined at build time (that is what NEXT_PUBLIC_ means), so it comes from a Docker build ARG,
// not the container's runtime environment. Three cases, and the empty one is deliberate:
//   undefined  -> local dev, the API is on its own port
//   ""         -> same-origin; requests go to /api/v1/... and next.config.mjs rewrites them
//   an origin  -> the API is addressed directly (sibling subdomains sharing a cookie domain)
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    // The API's exception filter returns `message` as either a string or an array of validation
    // failures (see ZodValidationPipe) — normalise so callers always get one headline plus details.
    const details = Array.isArray(body.message) ? (body.message as string[]) : undefined;
    const message = details?.[0] ?? (body.message as string) ?? "Request failed";
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Serialise a filter object into a query string, dropping empty values and expanding arrays. */
export function toQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * Uploads raw bytes to a presigned URL. Deliberately NOT part of `apiClient`: the target is the
 * S3/MinIO origin rather than `${API_BASE}/api/v1`, it must not send our session cookie, and the
 * Content-Type has to match the type the URL was signed with or the signature check fails.
 *
 * Uses XMLHttpRequest rather than fetch purely because fetch cannot report upload progress.
 */
export function uploadToPresignedUrl(
  url: string,
  file: Blob,
  options: {
    contentType: string;
    headers?: Record<string, string>;
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", options.contentType);
    for (const [key, value] of Object.entries(options.headers ?? {})) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(`Upload failed (${xhr.status})`, xhr.status));
    xhr.onerror = () =>
      reject(new ApiError("Upload failed — check the storage CORS configuration.", 0));
    xhr.onabort = () => reject(new ApiError("Upload cancelled", 0));

    options.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}
