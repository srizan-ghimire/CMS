"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// See the note in (auth)/login/page.tsx — useSearchParams() needs a Suspense boundary to build.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center px-4" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setIsSubmitting(false);
    if (resetError) {
      setError(resetError.message ?? "This reset link is invalid or has expired.");
      return;
    }
    router.push("/login");
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">
          This reset link is missing its token. Request a new one from the{" "}
          <a href="/forgot-password" className="text-primary hover:underline">
            forgot password
          </a>{" "}
          page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}
