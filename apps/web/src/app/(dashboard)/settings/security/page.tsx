"use client";

import { useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";

interface SessionRow {
  id: string;
  token: string;
  createdAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function describeDevice(userAgent?: string | null): string {
  if (!userAgent) return "Unknown device";
  if (/iphone|ipad/i.test(userAgent)) return "iOS device";
  if (/android/i.test(userAgent)) return "Android device";
  if (/mac os/i.test(userAgent)) return "Mac";
  if (/windows/i.test(userAgent)) return "Windows PC";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Browser";
}

export default function SecuritySettingsPage() {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const [enrollStep, setEnrollStep] = useState<"idle" | "password" | "verify">("idle");
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoadingSessions(true);
    const { data } = await authClient.listSessions();
    setSessions((data as SessionRow[] | null) ?? []);
    setLoadingSessions(false);
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const revoke = async (token: string) => {
    await authClient.revokeSession({ token });
    void loadSessions();
  };

  const startEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { data, error: enableError } = await authClient.twoFactor.enable({ password });
    if (enableError) {
      setError(enableError.message ?? "Couldn't start 2FA setup — check your password.");
      return;
    }
    setTotpUri(data?.totpURI ?? null);
    setBackupCodes(data?.backupCodes ?? null);
    setEnrollStep("verify");
  };

  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code: verifyCode });
    if (verifyError) {
      setError(verifyError.message ?? "That code didn't match — try again.");
      return;
    }
    setEnrollStep("idle");
    setTotpUri(null);
    setVerifyCode("");
  };

  const disable2fa = async () => {
    const currentPassword = window.prompt("Confirm your password to disable 2FA:");
    if (!currentPassword) return;
    await authClient.twoFactor.disable({ password: currentPassword });
  };

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Security</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage two-factor authentication and active sessions.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Two-factor authentication</h2>

        {session?.user?.twoFactorEnabled ? (
          <div className="border-border flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">2FA is enabled</p>
              <p className="text-muted-foreground text-sm">
                Your account requires a code from your authenticator app at sign-in.
              </p>
            </div>
            <button
              onClick={disable2fa}
              className="border-border min-h-11 shrink-0 rounded-md border px-3 text-sm sm:min-h-0 sm:py-1.5"
            >
              Disable
            </button>
          </div>
        ) : enrollStep === "idle" ? (
          <button
            onClick={() => setEnrollStep("password")}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            Enable two-factor authentication
          </button>
        ) : enrollStep === "password" ? (
          <form onSubmit={startEnrollment} className="max-w-sm space-y-3">
            <p className="text-muted-foreground text-sm">Confirm your password to continue.</p>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            >
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={confirmEnrollment} className="max-w-sm space-y-4">
            {totpUri && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  Scan this URI with your authenticator app (Google Authenticator, 1Password,
                  Authy):
                </p>
                <code className="bg-muted block break-all rounded-md p-2 text-xs">{totpUri}</code>
              </div>
            )}
            {backupCodes && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  Save these backup codes somewhere safe — each works once if you lose access to
                  your authenticator:
                </p>
                <div className="bg-muted grid grid-cols-2 gap-1 rounded-md p-2 font-mono text-xs">
                  {backupCodes.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              </div>
            )}
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              className="border-border bg-background w-full rounded-md border px-3 py-2 text-center text-lg tracking-widest"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              className="bg-primary text-primary-foreground w-full rounded-md py-2 text-sm font-medium"
            >
              Confirm & enable
            </button>
          </form>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Active sessions</h2>
        {loadingSessions ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-md border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{describeDevice(s.userAgent)}</p>
                  <p className="text-muted-foreground text-xs">
                    {s.ipAddress ?? "Unknown IP"} · signed in{" "}
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revoke(s.token)}
                  className="text-sm text-red-500 hover:underline"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
