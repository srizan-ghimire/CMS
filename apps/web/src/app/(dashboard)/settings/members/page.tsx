"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import type {
  WorkspaceInvitationDto,
  WorkspaceMemberDto,
  WorkspaceRole,
} from "@social-platform/shared";
import { apiClient } from "@/lib/api-client";
import { formatRelative } from "@/lib/utils";
import { roleAtLeast, useActiveWorkspace } from "@/hooks/use-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Skeleton } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ASSIGNABLE: WorkspaceRole[] = ["ADMIN", "MANAGER", "EDITOR", "VIEWER"];

export default function MembersPage() {
  const queryClient = useQueryClient();
  const { workspaceId, role, isLoading } = useActiveWorkspace();
  const canManage = roleAtLeast(role, "ADMIN");

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("EDITOR");

  const members = useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiClient.get<WorkspaceMemberDto[]>(`/workspaces/${workspaceId}/members`),
  });

  const invitations = useQuery({
    queryKey: ["invitations", workspaceId],
    // Only admins can read pending invitations, so don't fire a request that would 403.
    enabled: Boolean(workspaceId) && canManage,
    queryFn: () =>
      apiClient.get<WorkspaceInvitationDto[]>(`/workspaces/${workspaceId}/invitations`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["members"] });
    queryClient.invalidateQueries({ queryKey: ["invitations"] });
  };

  const invite = useMutation({
    mutationFn: () =>
      apiClient.post(`/workspaces/${workspaceId}/invitations`, { email, role: inviteRole }),
    onSuccess: () => {
      setEmail("");
      invalidate();
      toast.success("Invitation sent — check Mailhog in local dev");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not invite"),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: WorkspaceRole }) =>
      apiClient.patch(`/workspaces/${workspaceId}/members/${userId}`, { role: newRole }),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not change role"),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove member"),
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) =>
      apiClient.delete(`/workspaces/invitations/${invitationId}`),
    onSuccess: invalidate,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!workspaceId)
    return <p className="text-muted-foreground text-sm">Create a workspace first.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Who can work in this workspace, and what they can do.
        </p>
      </div>

      {canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) invite.mutate();
          }}
          className="border-border flex flex-wrap items-end gap-2 rounded-lg border p-3"
        >
          <div className="w-full space-y-1.5 sm:min-w-[200px] sm:flex-1">
            <Label htmlFor="email">Invite by email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-auto">
            <Label>Role</Label>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={!email.trim() || invite.isPending}
            className="w-full sm:w-auto"
          >
            <UserPlus className="h-4 w-4" />
            Invite
          </Button>
        </form>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Members</h2>
        <ul className="space-y-2">
          {members.data?.map((member) => (
            <li
              key={member.userId}
              className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{member.name}</p>
                <p className="text-muted-foreground truncate text-xs">{member.email}</p>
              </div>

              {member.isOwner ? (
                <Badge>owner</Badge>
              ) : canManage ? (
                <Select
                  value={member.role}
                  onValueChange={(v) =>
                    changeRole.mutate({ userId: member.userId, newRole: v as WorkspaceRole })
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{member.role.toLowerCase()}</Badge>
              )}

              <span className="text-muted-foreground text-xs">
                joined {formatRelative(member.joinedAt)}
              </span>

              {canManage && !member.isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${member.name}`}
                  onClick={() => removeMember.mutate(member.userId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {canManage && (invitations.data?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Pending invitations</h2>
          <ul className="space-y-2">
            {invitations.data?.map((invitation) => (
              <li
                key={invitation.id}
                className="border-border flex items-center gap-3 rounded-lg border border-dashed p-3"
              >
                <Mail className="text-muted-foreground h-4 w-4" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{invitation.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {invitation.role.toLowerCase()} · expires {formatRelative(invitation.expiresAt)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(invitation.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
