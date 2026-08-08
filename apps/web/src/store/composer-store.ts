"use client";

import { create } from "zustand";
import type { JSONContent } from "@tiptap/react";

export interface TargetDraft {
  socialAccountId: string;
  /** null means "inherit the shared content" — the common case. */
  contentOverride: string | null;
  contentJsonOverride: JSONContent | null;
  mediaAssetIds: string[] | null;
}

interface ComposerState {
  postId: string | null;
  title: string;
  contentJson: JSONContent | null;
  contentText: string;
  firstComment: string;
  mediaAssetIds: string[];
  targets: TargetDraft[];
  scheduledAt: string | null;
  /** Set on every local edit, cleared once a save round-trips — drives the autosave indicator. */
  isDirty: boolean;

  load: (state: Partial<ComposerState> & { postId: string | null }) => void;
  reset: () => void;
  setTitle: (title: string) => void;
  setContent: (doc: JSONContent, text: string) => void;
  setFirstComment: (value: string) => void;
  setMediaAssetIds: (ids: string[]) => void;
  toggleTarget: (socialAccountId: string) => void;
  setTargetOverride: (socialAccountId: string, doc: JSONContent | null, text: string | null) => void;
  setScheduledAt: (value: string | null) => void;
  markClean: () => void;
}

const EMPTY = {
  postId: null,
  title: "",
  contentJson: null,
  contentText: "",
  firstComment: "",
  mediaAssetIds: [],
  targets: [],
  scheduledAt: null,
  isDirty: false,
} satisfies Partial<ComposerState>;

/**
 * The composer's local editing buffer. Server state (the saved post) lives in TanStack Query;
 * this holds only what the user has typed but not yet persisted, so an in-flight autosave can
 * never clobber keystrokes made while it was in the air.
 */
export const useComposerStore = create<ComposerState>()((set) => ({
  ...EMPTY,

  load: (state) => set({ ...EMPTY, ...state, isDirty: false }),
  reset: () => set({ ...EMPTY }),

  setTitle: (title) => set({ title, isDirty: true }),
  setContent: (contentJson, contentText) => set({ contentJson, contentText, isDirty: true }),
  setFirstComment: (firstComment) => set({ firstComment, isDirty: true }),
  setMediaAssetIds: (mediaAssetIds) => set({ mediaAssetIds, isDirty: true }),
  setScheduledAt: (scheduledAt) => set({ scheduledAt, isDirty: true }),

  toggleTarget: (socialAccountId) =>
    set((state) => {
      const exists = state.targets.some((t) => t.socialAccountId === socialAccountId);
      return {
        targets: exists
          ? state.targets.filter((t) => t.socialAccountId !== socialAccountId)
          : [
              ...state.targets,
              { socialAccountId, contentOverride: null, contentJsonOverride: null, mediaAssetIds: null },
            ],
        isDirty: true,
      };
    }),

  setTargetOverride: (socialAccountId, doc, text) =>
    set((state) => ({
      targets: state.targets.map((target) =>
        target.socialAccountId === socialAccountId
          ? { ...target, contentJsonOverride: doc, contentOverride: text }
          : target,
      ),
      isDirty: true,
    })),

  markClean: () => set({ isDirty: false }),
}));
