"use client";

import { Quote } from "lucide-react";
import type { SnippetKind } from "@social-platform/shared";
import { useSnippets } from "@/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const KIND_LABEL: Record<SnippetKind, string> = {
  TEXT: "Text",
  HASHTAG_GROUP: "Hashtag groups",
  CTA: "Calls to action",
  SIGNATURE: "Signatures",
};

/** Drops a saved snippet into whichever field the caller nominates (caption or first comment). */
export function SnippetInserter({
  workspaceId,
  onInsert,
  disabled,
}: {
  workspaceId: string;
  onInsert: (body: string) => void;
  disabled?: boolean;
}) {
  const { data: snippets } = useSnippets(workspaceId);

  const grouped = (snippets ?? []).reduce<Record<string, typeof snippets>>((acc, snippet) => {
    (acc[snippet.kind] ??= []).push(snippet);
    return acc;
  }, {});

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Quote className="h-3.5 w-3.5" />
          Snippets
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        {(snippets ?? []).length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            No saved snippets. Create hashtag groups, CTAs or signatures in Settings.
          </p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {Object.entries(grouped).map(([kind, items]) => (
              <div key={kind} className="space-y-0.5">
                <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {KIND_LABEL[kind as SnippetKind] ?? kind}
                </p>
                {items?.map((snippet) => (
                  <button
                    key={snippet.id}
                    type="button"
                    onClick={() => onInsert(snippet.body)}
                    className="block w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="block truncate font-medium">{snippet.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {snippet.body}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
