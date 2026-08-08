import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { PrismaClient } from "@prisma/client";
import { sendMail } from "./email";

// This client is deliberately outside Nest's DI: `AuthModule.forRoot({ auth })` in app.module.ts
// needs the config object to exist at import time, before any injector is built. It is therefore
// a second pool alongside PrismaService, and nothing else would ever close it — Nest's shutdown
// hooks only reach providers it owns.
const prisma = new PrismaClient();
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void prisma.$disconnect();
  });
}

const isProduction = process.env.NODE_ENV === "production";

// Leading-dot parent domain (".example.com") to share the session cookie between app.example.com
// and api.example.com. Unset for a same-origin deployment. Note this cannot be a public suffix:
// browsers reject a Set-Cookie for ".onrender.com" or ".vercel.app" outright.
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;
const sameSite = (process.env.AUTH_COOKIE_SAME_SITE ?? "lax") as "lax" | "none" | "strict";

const trustedOrigins = (
  process.env.TRUSTED_ORIGINS ??
  process.env.WEB_URL ??
  "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Built once, up here, so the enabled set can be exported rather than re-derived. A provider is
// registered only when its credentials are present; the sign-in route 404s with
// PROVIDER_NOT_FOUND for anything absent, so the UI must not offer a button for one.
const socialProviders = {
  ...(process.env.GOOGLE_CLIENT_ID && {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  }),
  ...(process.env.GITHUB_CLIENT_ID && {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  }),
};

export type SocialProviderId = "google" | "github";

/** Which social providers are actually usable, for the sign-in UI to read. */
export const enabledSocialProviders = Object.keys(socialProviders) as SocialProviderId[];

export const auth = betterAuth({
  appName: "Social Platform",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:4000",
  basePath: "/api/auth",

  // Our frontend runs on a different origin than the API, so it must be explicitly trusted for
  // CORS + origin-check-based CSRF protection. Comma-separated to allow staging/preview origins.
  trustedOrigins,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Every model already defines its own String @id @default(cuid()) — let Prisma generate
  // ids rather than Better Auth, so every table in the schema (including our own domain
  // tables) uses the same id strategy. useSecureCookies flips on automatically in prod so
  // local http:// dev keeps working.
  //
  // The cookie scope below is load-bearing. `apps/web/src/middleware.ts` reads the session cookie
  // from the *web* origin's request to decide on optimistic redirects. If the cookie is host-only
  // to the API's hostname it never reaches the web app, and every protected route redirect-loops
  // to /login even with a perfectly valid session — so a split-host deployment must set
  // AUTH_COOKIE_DOMAIN to the shared parent.
  //
  // Both objects use conditional spreads rather than explicit-undefined keys on purpose: Better
  // Auth's createCookieGetter merges the cross-subdomain domain *before* defaultCookieAttributes,
  // so a literal `domain: undefined` in the latter would erase it.
  advanced: {
    database: { generateId: false },
    useSecureCookies: isProduction,
    ...(cookieDomain ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } } : {}),
    defaultCookieAttributes: {
      sameSite,
      secure: isProduction,
      // SameSite=None cookies are third-party by definition; CHIPS partitioning is what keeps
      // them working as browsers phase third-party cookies out.
      ...(sameSite === "none" && isProduction ? { partitioned: true } : {}),
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Reset your password",
        html: `<p>Someone requested a password reset for your Social Platform account.</p>
               <p><a href="${url}">Reset your password</a> — this link expires in 1 hour.</p>
               <p>If this wasn't you, you can safely ignore this email.</p>`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Verify your email",
        html: `<p>Welcome to Social Platform — confirm your email to get started.</p>
               <p><a href="${url}">Verify email address</a></p>`,
      });
    },
  },

  socialProviders,

  // "Remember me" is native: signIn.email({ ..., rememberMe: false }) issues a
  // browser-session-only cookie instead of one that persists for `expiresIn`.
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh the expiry once a day of activity
    cookieCache: { enabled: true, maxAge: 5 * 60 },
    additionalFields: {
      deviceName: { type: "string", required: false },
    },
  },

  plugins: [
    twoFactor({
      issuer: "Social Platform",
    }),
  ],
});

export type Auth = typeof auth;
