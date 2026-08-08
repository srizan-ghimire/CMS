"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Invitation acceptance. Deliberately inside the (dashboard) group so it sits behind the auth
 * middleware: accepting requires a signed-in account whose email matches the invited address, and
 * the API enforces that too — the token alone is never sufficient.
 */
export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);

  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setState("working");
    setError(null);
    try {
      const workspace = await apiClient.post<{ id: string; name: string }>(
        `/workspaces/invitations/${token}/accept`,
      );
      // Land the user in the workspace they just joined rather than whatever was last active.
      setActiveWorkspaceId(workspace.id);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "This invitation could not be accepted.");
      setState("error");
    }
  };

  return (
    <div className="mx-auto max-w-md pt-12">
      <Card>
        <CardHeader>
          <CardTitle>Join a workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You have been invited to collaborate. Accepting adds your account to the workspace.
          </p>

          {error && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <Button onClick={accept} disabled={state === "working"} className="w-full">
            <Check className="h-4 w-4" />
            {state === "working" ? "Joining…" : "Accept invitation"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
