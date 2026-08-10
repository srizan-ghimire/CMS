"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { extractTemplateVariables, type TemplateDto } from "@social-platform/shared";
import { apiClient, toQuery } from "@/lib/api-client";
import { roleAtLeast, useActiveWorkspace } from "@/hooks/use-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Skeleton } from "@/components/ui/misc";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function TemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId, role, isLoading } = useActiveWorkspace();
  const canManage = roleAtLeast(role, "MANAGER");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", content: "" });
  const [using, setUsing] = useState<TemplateDto | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["templates", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiClient.get<TemplateDto[]>(`/templates${toQuery({ workspaceId })}`),
  });

  const create = useMutation({
    mutationFn: () =>
      apiClient.post<TemplateDto>("/templates", {
        workspaceId,
        name: form.name,
        content: form.content,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setCreateOpen(false);
      setForm({ name: "", content: "" });
      toast.success("Template created");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create template"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  const instantiate = useMutation({
    mutationFn: (template: TemplateDto) =>
      apiClient.post<{ postId: string }>(`/templates/${template.id}/instantiate`, {
        variables: values,
        socialAccountIds: [],
      }),
    onSuccess: ({ postId }) => {
      setUsing(null);
      setValues({});
      // Straight into the composer with the substituted draft already saved.
      router.push(`/composer?id=${postId}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not use template"),
  });

  // Preview the placeholders live so the author sees what they're creating before saving.
  const draftVariables = extractTemplateVariables(form.content);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!workspaceId)
    return <p className="text-muted-foreground text-sm">Create a workspace first.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Reusable post formats. Use <code className="text-xs">{"{{variable}}"}</code> for the
            parts that change each time.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New template
          </Button>
        )}
      </div>

      {(data?.length ?? 0) === 0 ? (
        <div className="border-border text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
          No templates yet.
        </div>
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((template) => (
            <StaggerItem key={template.id}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge variant="secondary">used {template.usageCount}×</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap text-sm">
                    {template.content}
                  </p>
                  {template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map((v) => (
                        <Badge key={v} variant="outline">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        setUsing(template);
                        setValues(Object.fromEntries(template.variables.map((v) => [v, ""])));
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Use
                    </Button>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove.mutate(template.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
            <DialogDescription>
              Variables are detected automatically from {"{{double braces}}"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tname">Name</Label>
              <Input
                id="tname"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tcontent">Content</Label>
              <Textarea
                id="tcontent"
                className="min-h-[120px]"
                placeholder="Introducing {{product}} — available from {{date}}."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
              {draftVariables.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  Detected: {draftVariables.join(", ")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!form.name.trim() || !form.content.trim() || create.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use */}
      <Dialog open={Boolean(using)} onOpenChange={(open) => !open && setUsing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use &ldquo;{using?.name}&rdquo;</DialogTitle>
            <DialogDescription>
              Fill these in to create a draft. Anything left blank stays visible as{" "}
              {"{{placeholder}}"} so it&apos;s obvious what still needs writing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(using?.variables ?? []).map((variable) => (
              <div key={variable} className="space-y-1.5">
                <Label htmlFor={`var-${variable}`}>{variable}</Label>
                <Input
                  id={`var-${variable}`}
                  value={values[variable] ?? ""}
                  onChange={(e) => setValues({ ...values, [variable]: e.target.value })}
                />
              </div>
            ))}
            {(using?.variables.length ?? 0) === 0 && (
              <p className="text-muted-foreground text-sm">
                This template has no variables — it will be copied as-is.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => using && instantiate.mutate(using)}
              disabled={instantiate.isPending}
            >
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
