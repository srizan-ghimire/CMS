"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { registerSchema, type RegisterInput } from "@social-platform/shared";
import { appUrl, authClient } from "@/lib/auth-client";
import { AuthShell, Field } from "@/components/auth/auth-shell";
import { SocialSignIn } from "@/components/auth/social-sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterInput) => {
    setFormError(null);
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      // Where the verification link lands once clicked. Must be absolute on the web origin —
      // Better Auth defaults to "/" and redirects to it verbatim from the API, which would drop
      // the user on the API root. autoSignInAfterVerification is on, so /dashboard is reachable.
      callbackURL: appUrl("/dashboard"),
    });
    if (error) {
      setFormError(error.message ?? "Unable to create your account.");
      return;
    }
    // requireEmailVerification is on, so there's no active session yet.
    setSubmittedEmail(values.email);
  };

  // Verification links expire after an hour, and signing up again with the same address fails
  // because the account already exists — without this the user is simply stuck.
  const resend = async () => {
    if (!submittedEmail) return;
    setResendState("sending");
    const { error } = await authClient.sendVerificationEmail({
      email: submittedEmail,
      callbackURL: appUrl("/dashboard"),
    });
    setResendState(error ? "error" : "sent");
  };

  if (submittedEmail) {
    return (
      <AuthShell
        marker="02 / Almost there"
        title="Check your email."
        subtitle={
          <>
            We sent a verification link to{" "}
            <span className="text-foreground">{submittedEmail}</span>. Confirm it and you can sign
            in.
          </>
        }
      >
        <div className="border border-dashed border-border p-5">
          <MailCheck className="h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Nothing arrived? Check your spam folder. The link is valid for one hour — after that,
            send yourself a new one.
          </p>
          <button
            type="button"
            onClick={resend}
            disabled={resendState === "sending" || resendState === "sent"}
            className="marker mt-4 text-foreground underline underline-offset-4 disabled:no-underline disabled:opacity-60"
          >
            {resendState === "sending"
              ? "Sending…"
              : resendState === "sent"
                ? "New link sent"
                : resendState === "error"
                  ? "Couldn't send — try again"
                  : "Resend verification email"}
          </button>
        </div>

        <Button asChild size="xl" variant="outline" className="mt-6 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      marker="02 / Create account"
      title="Start publishing."
      subtitle="One composer for every network you run. No card required."
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
          .
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Field id="name" label="Name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" className="h-11" {...register("name")} />
        </Field>

        <Field id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" className="h-11" {...register("email")} />
        </Field>

        <Field
          id="password"
          label="Password"
          error={errors.password?.message}
          hint="At least 10 characters, one uppercase letter, one number."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="h-11"
            {...register("password")}
          />
        </Field>

        {formError && (
          <p className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}

        <Button type="submit" size="xl" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      {/* Social sign-up skips email verification entirely — the provider has already proven the
          address, so these users land straight on the dashboard. */}
      <SocialSignIn />
    </AuthShell>
  );
}
