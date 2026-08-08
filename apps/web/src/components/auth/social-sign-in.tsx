"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { appUrl, authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type SocialProviderId = "google" | "github";

const LABELS: Record<SocialProviderId, string> = {
  google: "Google",
  github: "GitHub",
};

/**
 * Renders a button per social provider the API reports as configured — and nothing at all when
 * none are. Better Auth 404s `sign-in/social` for a provider it never registered, so an
 * unconditional button is a dead button in any environment without those credentials.
 */
export function SocialSignIn({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const { data } = useQuery({
    queryKey: ["auth", "providers"],
    queryFn: () => apiClient.get<{ social: SocialProviderId[] }>("/auth/providers"),
    // This changes only on redeploy, and a failure here must never block the sign-in form.
    staleTime: Infinity,
    retry: false,
  });

  const providers = data?.social ?? [];
  if (providers.length === 0) return null;

  const signIn = (provider: SocialProviderId) =>
    authClient.signIn.social({
      provider,
      callbackURL: appUrl(redirectTo),
    });

  return (
    <div className="mt-8">
      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="marker text-muted-foreground">Or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div
        className={
          providers.length > 1 ? "mt-5 grid grid-cols-2 gap-3" : "mt-5 grid grid-cols-1 gap-3"
        }
      >
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="lg"
            onClick={() => signIn(provider)}
          >
            {LABELS[provider]}
          </Button>
        ))}
      </div>
    </div>
  );
}
