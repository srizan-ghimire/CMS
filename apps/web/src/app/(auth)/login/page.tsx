"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@social-platform/shared";
import { authClient } from "@/lib/auth-client";
import { AuthShell, Field } from "@/components/auth/auth-shell";
import { SocialSignIn } from "@/components/auth/social-sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";

// useSearchParams() opts the subtree into client-side rendering, which Next 15 rejects at build
// time unless it sits under a Suspense boundary (same reason settings/connections has one).
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: true },
  });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    const { error } = await authClient.signIn.email(
      {
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      },
      {
        onSuccess: (context) => {
          if (context.data?.twoFactorRedirect) {
            router.push("/verify-2fa");
            return;
          }
          router.push(searchParams.get("redirectTo") ?? "/dashboard");
        },
      },
    );
    if (error) {
      setFormError(error.message ?? "Unable to sign in. Check your credentials and try again.");
    }
  };

  return (
    <AuthShell
      marker="01 / Sign in"
      title="Welcome back."
      footer={
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-foreground underline underline-offset-4">
            Create one
          </Link>
          .
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" className="h-11" {...register("email")} />
        </Field>

        <Field id="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-11"
            {...register("password")}
          />
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox
              checked={watch("rememberMe") ?? true}
              onCheckedChange={(checked) => setValue("rememberMe", checked === true)}
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {formError && (
          <p className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}

        <Button type="submit" size="xl" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <SocialSignIn redirectTo={searchParams.get("redirectTo") ?? "/dashboard"} />
    </AuthShell>
  );
}
