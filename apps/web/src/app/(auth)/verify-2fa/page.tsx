"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function VerifyTwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: verifyError } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code });

    setIsSubmitting(false);
    if (verifyError) {
      setError(verifyError.message ?? "Invalid code — try again.");
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Two-factor verification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {useBackupCode
              ? "Enter one of your unused backup codes."
              : "Enter the 6-digit code from your authenticator app."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            autoFocus
            inputMode={useBackupCode ? "text" : "numeric"}
            maxLength={useBackupCode ? 16 : 6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-widest"
            placeholder={useBackupCode ? "XXXX-XXXX" : "••••••"}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || code.length === 0}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {isSubmitting ? "Verifying…" : "Verify"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setUseBackupCode((v) => !v);
            setCode("");
            setError(null);
          }}
          className="w-full text-center text-sm text-primary hover:underline"
        >
          {useBackupCode ? "Use authenticator code instead" : "Use a backup code instead"}
        </button>
      </div>
    </div>
  );
}
