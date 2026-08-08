"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The active workspace, persisted so a reload doesn't reset it. Every workspace-scoped page reads
 * from here instead of duplicating the ad-hoc `<select>` that settings/connections used to own.
 *
 * Holds only the id — the workspace list itself is server state and belongs to TanStack Query
 * (see `useWorkspaces`), so the two can't drift out of sync after a rename.
 */
interface WorkspaceState {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
    }),
    { name: "social-platform:active-workspace" },
  ),
);
