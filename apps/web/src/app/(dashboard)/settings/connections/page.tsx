"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";

type Platform = "FACEBOOK" | "INSTAGRAM" | "TIKTOK";
type AccountStatus = "CONNECTED" | "TOKEN_EXPIRED" | "REVOKED" | "ERROR";

interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: "OWNER" | "ADMIN" | "MANAGER" | "EDITOR" | "VIEWER";
}

interface SocialAccountRow {
  id: string;
  platform: Platform;
  externalAccountId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  status: AccountStatus;
  tokenExpiresAt: string | null;
  scopes: string[];
  connectedById: string | null;
  createdAt: string;
  updatedAt: string;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

const STATUS_STYLE: Record<AccountStatus, string> = {
  CONNECTED: "bg-emerald-500/10 text-emerald-600",
  TOKEN_EXPIRED: "bg-amber-500/10 text-amber-600",
  REVOKED: "bg-muted text-muted-foreground",
  ERROR: "bg-red-500/10 text-red-600",
};

const CAN_MANAGE_ROLES = new Set(["OWNER", "ADMIN", "MANAGER"]);

function ConnectionsPageContent() {
  const searchParams = useSearchParams();

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SocialAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const count = searchParams.get("count");
    const errorParam = searchParams.get("error");

    if (errorParam === "connection_failed") {
      setBanner("That connection didn't go through — please try again.");
    } else if (connected) {
      const n = Number(count ?? "0");
      setBanner(
        n > 0
          ? `Connected ${n} ${PLATFORM_LABEL[connected.toUpperCase() as Platform] ?? connected} account${n === 1 ? "" : "s"}.`
          : "No new accounts were connected — you may have cancelled the request.",
      );
    }
  }, [searchParams]);

  useEffect(() => {
    apiClient
      .get<WorkspaceSummary[]>("/workspaces/mine")
      .then((ws) => {
        setWorkspaces(ws);
        setWorkspaceId((current) => current ?? ws[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load workspaces."));
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const rows = await apiClient.get<SocialAccountRow[]>(
        `/social-accounts/workspaces/${workspaceId}`,
      );
      setAccounts(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load connected accounts.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);
  const canManage = currentWorkspace ? CAN_MANAGE_ROLES.has(currentWorkspace.role) : false;

  const connect = async (platform: "facebook" | "tiktok") => {
    if (!workspaceId) return;
    setConnecting(platform === "facebook" ? "FACEBOOK" : "TIKTOK");
    try {
      const { url } = await apiClient.get<{ url: string }>(
        `/social-accounts/${platform}/connect?workspaceId=${workspaceId}&redirectPath=/settings/connections`,
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the connection.");
      setConnecting(null);
    }
  };

  const disconnect = async (accountId: string) => {
    if (!window.confirm("Disconnect this account? You can reconnect it later.")) return;
    try {
      await apiClient.delete(`/social-accounts/${accountId}`);
      void loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't disconnect this account.");
    }
  };

  const refresh = async (accountId: string) => {
    try {
      await apiClient.post(`/social-accounts/${accountId}/refresh`);
      void loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't refresh this account's token.");
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect the Facebook Pages, Instagram Business accounts, and TikTok accounts this
          workspace publishes to.
        </p>
      </div>

      {workspaces.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="workspace" className="text-sm text-muted-foreground">
            Workspace
          </label>
          <select
            id="workspace"
            value={workspaceId ?? ""}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {banner && (
        <div className="flex items-start justify-between rounded-md border border-border bg-muted/40 p-3 text-sm">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="text-muted-foreground hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {canManage && (
        <section className="flex flex-wrap gap-3">
          <button
            onClick={() => connect("facebook")}
            disabled={connecting !== null || !workspaceId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {connecting === "FACEBOOK" ? "Redirecting…" : "Connect Facebook & Instagram"}
          </button>
          <button
            onClick={() => connect("tiktok")}
            disabled={connecting !== null || !workspaceId}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {connecting === "TIKTOK" ? "Redirecting…" : "Connect TikTok"}
          </button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Connected accounts</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No accounts connected yet. Connect Facebook to also pick up any linked Instagram
            Business account automatically.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  {account.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={account.avatarUrl}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {PLATFORM_LABEL[account.platform].slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{account.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {PLATFORM_LABEL[account.platform]}
                      {account.handle ? ` · @${account.handle}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[account.status]}`}
                  >
                    {account.status.replace("_", " ").toLowerCase()}
                  </span>
                  {canManage && account.platform === "TIKTOK" && (
                    <button
                      onClick={() => refresh(account.id)}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Refresh
                    </button>
                  )}
                  {canManage && account.status !== "REVOKED" && (
                    <button
                      onClick={() => disconnect(account.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ConnectionsPageContent />
    </Suspense>
  );
}
