"use client";

import { useState } from "react";
import { Check, Plus, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import type { TagDto } from "@social-platform/shared";
import { cn } from "@/lib/utils";
import { useCreateTag, useTags } from "@/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Assigns tags to a post or asset. Emits the full desired set rather than add/remove deltas,
 * because that's what the API takes — a replace is atomic and can't drift.
 */
export function TagPicker({
  selectedIds,
  onChange,
  workspaceId,
  disabled,
}: {
  selectedIds: string[];
  onChange: (tagIds: string[]) => void;
  workspaceId: string;
  disabled?: boolean;
}) {
  const { data: tags } = useTags(workspaceId);
  const createTag = useCreateTag(workspaceId);
  const [newName, setNewName] = useState("");

  const selected = (tags ?? []).filter((t) => selectedIds.includes(t.id));

  const toggle = (tag: TagDto) =>
    onChange(
      selectedIds.includes(tag.id)
        ? selectedIds.filter((id) => id !== tag.id)
        : [...selectedIds, tag.id],
    );

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const tag = await createTag.mutateAsync(name);
      onChange([...selectedIds, tag.id]);
      setNewName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create tag");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
        >
          {tag.name}
        </Badge>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            <TagIcon className="h-3.5 w-3.5" />
            {selected.length > 0 ? "Edit tags" : "Add tags"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="max-h-52 space-y-0.5 overflow-y-auto">
            {(tags ?? []).length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No tags yet — create the first one below.
              </p>
            )}
            {(tags ?? []).map((tag) => {
              const active = selectedIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggle(tag)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    active && "font-medium",
                  )}
                >
                  <span className="w-4">{active && <Check className="h-3.5 w-3.5" />}</span>
                  {tag.color && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tag.postCount + tag.assetCount}
                  </span>
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
            className="mt-2 flex gap-1 border-t border-border pt-2"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New tag"
              className="h-8"
            />
            <Button type="submit" size="sm" disabled={!newName.trim() || createTag.isPending}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
