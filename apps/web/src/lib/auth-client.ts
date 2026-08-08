import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // Empty string is a valid value here, meaning same-origin — see the note in api-client.ts.
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  // The API may live on a different origin than this app — cookies must be explicitly included
  // on cross-origin requests.
  fetchOptions: { credentials: "include" },
  plugins: [
    twoFactorClient({
      // Where signIn.email() redirects when a user with 2FA enabled needs a second factor.
      twoFactorPage: "/verify-2fa",
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;

/**
 * Absolute URL on *this* app's origin, for any callbackURL / redirectTo handed to Better Auth.
 *
 * Better Auth puts these straight into a Location header on a response served by the API, so the
 * browser resolves a relative path against the API's origin — sending the user to
 * `api.<host>/dashboard` instead of the app. Every such value must therefore be absolute, and it
 * must name the web origin. The origin also has to appear in the API's TRUSTED_ORIGINS, which
 * validates it before redirecting.
 *
 * Call only from client components; it reads window.
 */
export function appUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}
