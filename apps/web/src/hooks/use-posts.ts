"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreatePostInput,
  PostDto,
  SocialAccountSummary,
  TargetValidation,
  UpdatePostInput,
} from "@social-platform/shared";
import { apiClient, toQuery } from "@/lib/api-client";

export interface PostListFilters {
  status?: string[];
  search?: string;
  includeArchived?: boolean;
  socialAccountId?: string;
}

export function usePosts(workspaceId: string | null, filters: PostListFilters = {}) {
  return useQuery({
    queryKey: ["posts", workspaceId, filters],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      apiClient.get<{ items: PostDto[]; nextCursor: string | null }>(
        `/posts${toQuery({
          workspaceId,
          status: filters.status,
          search: filters.search,
          includeArchived: filters.includeArchived,
          socialAccountId: filters.socialAccountId,
        })}`,
      ),
  });
}

export function usePost(postId: string | null) {
  return useQuery({
    queryKey: ["post", postId],
    enabled: Boolean(postId),
    queryFn: () => apiClient.get<PostDto>(`/posts/${postId}`),
  });
}

/** Server-side platform validation. Kept separate from the post query so it can refetch on every
 *  content change without re-pulling the post itself. */
export function usePostValidation(postId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["post-validation", postId],
    enabled: Boolean(postId) && enabled,
    queryFn: () => apiClient.get<TargetValidation[]>(`/posts/${postId}/validate`),
  });
}

export function useSocialAccounts(workspaceId: string | null) {
  return useQuery({
    queryKey: ["social-accounts", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      apiClient.get<SocialAccountSummary[]>(`/social-accounts/workspaces/${workspaceId}`),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => apiClient.post<PostDto>("/posts", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePostInput }) =>
      apiClient.patch<PostDto>(`/posts/${id}`, input),
    onSuccess: (post) => {
      queryClient.setQueryData(["post", post.id], post);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post-validation", post.id] });
    },
  });
}

export function usePostAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "duplicate" | "archive" | "unarchive" }) =>
      apiClient.post<PostDto>(`/posts/${id}/${action}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/posts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });
}
