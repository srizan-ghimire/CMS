"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CampaignStatus, type CampaignDto } from "@social-platform/shared";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const { workspaceId, role, isLoading } = useActiveWorkspace();
  const canManage = roleAtLeast(role, "MANAGER");
  const [open, setOpen] = useState(false);
  // Annotated so `status` widens to the union rather than being inferred as the literal
  // "PLANNING" from its initial value.
  const [form, setForm] = useState<{ name: string; description: string; status: CampaignStatus }>({
    name: "",
    description: "",
    status: CampaignStatus.PLANNING,
  });

  const { data } = useQuery({
    queryKey: ["campaigns", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiClient.get<CampaignDto[]>(`/campaigns${toQuery({ workspaceId })}`),
  });

  const create = useMutation({
    mutationFn: () =>
      apiClient.post<CampaignDto>("/campaigns", {
        workspaceId,
        name: form.name,
        description: form.description || null,
        status: form.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setOpen(false);
      setForm({ name: "", description: "", status: CampaignStatus.PLANNING });
      toast.success("Campaign created");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create campaign"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign deleted — its posts are unaffected");
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!workspaceId) {
    return <p className="text-muted-foreground text-sm">Create a workspace first.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Group related posts and track how much of each campaign has gone out.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New campaign
          </Button>
        )}
      </div>

      {(data?.length ?? 0) === 0 ? (
        <div className="border-border text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
          No campaigns yet.
        </div>
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((campaign) => (
            <StaggerItem key={campaign.id}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <Badge variant={campaign.status === "ACTIVE" ? "success" : "secondary"}>
                      {campaign.status.toLowerCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {campaign.description && (
                    <p className="text-muted-foreground text-sm">{campaign.description}</p>
                  )}
                  <p className="text-sm">
                    <span className="font-medium">{campaign.publishedCount}</span> of{" "}
                    <span className="font-medium">{campaign.postCount}</span> posts published
                  </p>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => remove.mutate(campaign.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as CampaignStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CampaignStatus).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!form.name.trim() || create.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
