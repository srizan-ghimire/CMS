"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CampaignDto, SnippetDto, TagDto, TemplateDto } from "@social-platform/shared";
import { apiClient, toQuery } from "@/lib/api-client";

export function useTags(workspaceId: string | null) {
  return useQuery({
    queryKey: ["tags", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiClient.get<TagDto[]>(`/tags${toQuery({ workspaceId })}`),
  });
}

export function useCreateTag(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiClient.post<TagDto>("/tags", { workspaceId, name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });
}

/** Replaces the whole tag set on a post or asset — the API takes the full list, not a delta. */
export function useSetTags(entity: "posts" | "media") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tagIds }: { id: string; tagIds: string[] }) =>
      apiClient.post(`/${entity}/${id}/tags`, { tagIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entity === "posts" ? "post" : "media"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useCampaigns(workspaceId: string | null) {
  return useQuery({
    queryKey: ["campaigns", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiClient.get<CampaignDto[]>(`/campaigns${toQuery({ workspaceId })}`),
  });
}

export function useAssignCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, campaignId }: { postId: string; campaignId: string | null }) =>
      apiClient.post(`/posts/${postId}/campaign`, { campaignId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useSnippets(workspaceId: string | null) {
  return useQuery({
    queryKey: ["snippets", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiClient.get<SnippetDto[]>(`/snippets${toQuery({ workspaceId })}`),
  });
}

export function useTemplates(workspaceId: string | null) {
  return useQuery({
    queryKey: ["templates", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiClient.get<TemplateDto[]>(`/templates${toQuery({ workspaceId })}`),
  });
}
