"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateWorkspaceInput, WorkspaceRole } from "@social-platform/shared";
import { apiClient } from "@/lib/api-client";
import { useWorkspaceStore } from "@/store/workspace-store";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: WorkspaceRole;
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: () => apiClient.get<WorkspaceSummary[]>("/workspaces/mine"),
  });
}

/**
 * Resolves the active workspace, self-healing two cases the persisted id can't handle on its own:
 * nothing selected yet (first visit), and a stored id the user no longer has access to (removed
 * from the workspace, or a stale id from another account on the same browser).
 */
export function useActiveWorkspace() {
  const { data: workspaces, isLoading, error } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);

  const active = workspaces?.find((w) => w.id === activeWorkspaceId) ?? null;

  useEffect(() => {
    if (!workspaces || workspaces.length === 0) return;
    if (!active) setActiveWorkspaceId(workspaces[0]!.id);
  }, [workspaces, active, setActiveWorkspaceId]);

  return {
    workspaces: workspaces ?? [],
    workspace: active,
    workspaceId: active?.id ?? null,
    role: active?.role ?? null,
    setActiveWorkspaceId,
    isLoading,
    error,
  };
}

/**
 * Creates a workspace and immediately makes it the active one — a workspace you cannot see is
 * indistinguishable from one that was never created, and every dashboard page keys off the active
 * id. `slug` is optional: the API derives and de-duplicates one from the name.
 */
export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);

  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) =>
      apiClient.post<WorkspaceSummary>("/workspaces", input),
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setActiveWorkspaceId(workspace.id);
    },
  });
}

const RANK: WorkspaceRole[] = ["OWNER", "ADMIN", "MANAGER", "EDITOR", "VIEWER"];

/** Mirrors the API's `atLeast()` in apps/api/src/modules/workspaces/lib/roles.ts — for hiding
 *  controls the server would reject anyway. Never the authorization boundary. */
export function roleAtLeast(role: WorkspaceRole | null, minimum: WorkspaceRole): boolean {
  if (!role) return false;
  return RANK.indexOf(role) <= RANK.indexOf(minimum);
}
