import { z } from "zod";

export interface ApiError {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
}

/** Every workspace-scoped list endpoint takes these. Kept in one place because `main.ts`'s
 *  `forbidNonWhitelisted: true` 400s any query param a DTO doesn't declare. */
export const cursorPaginationSchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export const workspaceScopedSchema = z.object({
  workspaceId: z.string().cuid(),
});
