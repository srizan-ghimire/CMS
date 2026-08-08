"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useActiveWorkspace } from "@/hooks/use-workspace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

export function WorkspaceSwitcher() {
  const { workspaces, workspaceId, setActiveWorkspaceId, isLoading } = useActiveWorkspace();
  const [creating, setCreating] = useState(false);

  if (isLoading) return <Skeleton className="h-9 w-full" />;

  // A user with no workspace can do nothing at all, so this is a call to action rather than the
  // dead "No workspaces" label it used to be.
  if (workspaces.length === 0) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => setCreating(true)}
        >
          <Plus />
          New workspace
        </Button>
        <CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
      </>
    );
  }

  return (
    <>
      <Select
        value={workspaceId ?? undefined}
        onValueChange={(value) => {
          // Radix Select has no "action item", so the create entry is a sentinel value rather
          // than a selectable workspace.
          if (value === NEW_WORKSPACE) {
            setCreating(true);
            return;
          }
          setActiveWorkspaceId(value);
        }}
      >
        <SelectTrigger aria-label="Active workspace">
          <SelectValue placeholder="Select a workspace" />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              {workspace.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW_WORKSPACE} className="text-muted-foreground">
            + New workspace
          </SelectItem>
        </SelectContent>
      </Select>
      <CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

const NEW_WORKSPACE = "__new_workspace__";
