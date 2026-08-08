"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { appUrl, authClient } from "@/lib/auth-client";
import { AuthShell, Field } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const { error: reqError } = await authClient.requestPasswordReset({
      email,
      // Absolute on the web origin. Better Auth builds the emailed link from this and redirects
      // to it verbatim from the API, so a relative "/reset-password" resolves against the API's
      // host and 404s.
      redirectTo: appUrl("/reset-password"),
    });
    setIsSubmitting(false);
    if (reqError) {
      setError(reqError.message ?? "Something went wrong.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell
        marker="03 / Password reset"
        title="Check your email."
        subtitle="If an account exists for that address, a reset link is on its way. It expires in one hour."
      >
        <div className="border border-dashed border-border p-5">
          <MailCheck className="h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Nothing arrived? Check your spam folder, then try again.
          </p>
        </div>

        <Button asChild size="xl" variant="outline" className="mt-6 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      marker="03 / Password reset"
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to set a new one."
      footer={
        <p className="text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
          .
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <Field id="email" label="Email" error={error ?? undefined}>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Field>

        <Button type="submit" size="xl" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
