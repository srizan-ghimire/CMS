"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkspaceSchema, type CreateWorkspaceInput } from "@social-platform/shared";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { useCreateWorkspace } from "@/hooks/use-workspace";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";

/**
 * A workspace owns every social account, post and media asset, so a user with none has nothing to
 * act on — this is the one thing a brand-new account must be able to do.
 */
export function CreateWorkspaceDialog({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const createWorkspace = useCreateWorkspace();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateWorkspaceInput>({ resolver: zodResolver(createWorkspaceSchema) });

  const onSubmit = async (values: CreateWorkspaceInput) => {
    try {
      // The schema is .strict(), so an empty slug string would be a 400 rather than "derive one
      // from the name" — drop the key entirely when it's blank.
      const payload: CreateWorkspaceInput = values.slug
        ? values
        : { name: values.name };
      const workspace = await createWorkspace.mutateAsync(payload);
      toast.success(`Created ${workspace.name}`);
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not create the workspace.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              Workspaces keep accounts, content and media separate — one per brand or client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-5">
            <div>
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                autoFocus
                placeholder="Alto Studio"
                className="mt-1.5"
                {...register("name")}
              />
              {errors.name && (
                <p className="mt-1.5 text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="workspace-slug">
                Slug <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="workspace-slug"
                placeholder="alto-studio"
                className="mt-1.5"
                {...register("slug")}
              />
              {errors.slug ? (
                <p className="mt-1.5 text-xs text-destructive">{errors.slug.message}</p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Derived from the name if left blank.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWorkspace.isPending}>
              {createWorkspace.isPending ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
