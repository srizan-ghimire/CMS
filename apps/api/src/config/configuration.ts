import { z } from "zod";

/** A URL that only resolves on the machine it was written on — never valid in production. */
function isLoopback(url: string | undefined): boolean {
  if (!url) return true;
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal|minio|mailhog)(:|\/|$)/i.test(
    url,
  );
}

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Render (and most PaaS) inject PORT and expect the process to bind it. API_PORT stays as the
  // local-dev knob; PORT wins when both are present.
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().default(4000),

  WEB_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  BETTER_AUTH_SECRET: z.string().min(16),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  // The origin Better Auth builds its own browser-facing URLs from — verification links, password
  // reset links, OAuth callbacks. Must be the origin the *browser* reaches Better Auth on.
  BETTER_AUTH_URL: z.string().url().optional(),

  // Comma-separated. Feeds both CORS and Better Auth's origin-based CSRF check. Falls back to
  // WEB_URL, which is the single-origin case.
  TRUSTED_ORIGINS: z.string().optional(),

  // Session cookie scope. Leave AUTH_COOKIE_DOMAIN unset for a same-origin deployment; set it to a
  // leading-dot parent (".example.com") to share the cookie between app.example.com and
  // api.example.com. It cannot be a public-suffix domain — browsers reject `.onrender.com`.
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  AUTH_COOKIE_SAME_SITE: z.enum(["lax", "none", "strict"]).default("lax"),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional(),

  // The origin the *browser* reaches storage on for **presigned** URLs. Distinct from S3_ENDPOINT,
  // which is how the API reaches it: in Docker the API talks to http://minio:9000 while the browser
  // talks to http://localhost:9000. Rewriting the host of a presigned URL is only safe because
  // MinIO does not verify the Host header — it is NOT safe on R2 or AWS, where `host` is a signed
  // header, so on those backends leave this unset. Defaults to S3_ENDPOINT.
  S3_PUBLIC_URL: z.string().url().optional(),

  // The origin **unsigned, public** object reads are served from — an R2 custom domain, an r2.dev
  // subdomain, or a public MinIO. Bucket-rooted (no /<bucket>/ path segment). Unlike S3_PUBLIC_URL
  // this never has a signature attached, so a different host is fine.
  S3_PUBLIC_READ_URL: z.string().url().optional(),

  // The internet-reachable base URL Meta/TikTok can fetch media from. Instagram and Facebook
  // publish by handing the platform a URL that *their* servers download, so localhost is useless
  // to them. Leave empty in local dev — the publish pipeline then selects the stub publisher
  // rather than failing deep inside a queue job. Required in production (see the refinement below).
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional().or(z.literal("")),

  MEDIA_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(1024 * 1024 * 1024), // 1 GiB
  MEDIA_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

  // 32-byte key (64 hex chars) used for AES-256-GCM encryption of stored OAuth tokens.
  // Generate with: openssl rand -hex 32
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"),

  // Public origin the API itself is reachable at — used to build OAuth redirect_uri values
  // registered with Facebook/TikTok. Distinct from WEB_URL, which is the frontend's origin.
  API_URL: z.string().url().default("http://localhost:4000"),

  // emailAndPassword.requireEmailVerification is on, so without working SMTP nobody can ever
  // finish signing up. Defaults target Mailhog for local dev.
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("no-reply@socialplatform.dev"),

  // Set this and mail goes out over Resend's HTTPS API instead of SMTP; leave it unset and the
  // SMTP_* settings above are used. Not merely a preference on a PaaS: Render blocks outbound 25,
  // 465 and 587, so SMTP there fails with ETIMEDOUT on CONN inside a Better Auth background task —
  // signup looks successful and no verification mail is ever sent. Local dev leaves this unset
  // because Mailhog only speaks SMTP.
  RESEND_API_KEY: z.string().optional(),

  FACEBOOK_APP_ID: z.string().default(""),
  FACEBOOK_APP_SECRET: z.string().default(""),
  FACEBOOK_GRAPH_VERSION: z.string().default("v23.0"),

  TIKTOK_CLIENT_KEY: z.string().default(""),
  TIKTOK_CLIENT_SECRET: z.string().default(""),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),

  // Swagger is public at /api/docs, which publishes the whole API surface. Off in production
  // unless deliberately re-enabled.
  ENABLE_SWAGGER: z.enum(["true", "false"]).default("false"),

  // The container entrypoint runs `prisma migrate deploy` before starting. Set false when
  // migrations are handled out of band (e.g. Render's preDeployCommand on a paid plan).
  RUN_MIGRATIONS_ON_BOOT: z.enum(["true", "false"]).default("true"),
});

/**
 * Every default in the schema above is tuned for local development, which means a production
 * deploy that simply forgets a variable boots *successfully* into a broken state rather than
 * failing. The worst case is MEDIA_PUBLIC_BASE_URL: unset, every platform resolves to
 * StubPublisher and the app cheerfully reports posts as published that never left the building.
 *
 * These checks turn each of those into a boot-time crash with a message naming the fix.
 */
const envSchema = baseSchema.superRefine((v, ctx) => {
  if (v.NODE_ENV !== "production") return;

  const reject = (path: keyof typeof v, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if (!v.MEDIA_PUBLIC_BASE_URL) {
    reject(
      "MEDIA_PUBLIC_BASE_URL",
      "required in production. Without it every platform resolves to StubPublisher: posts are " +
        "marked published but never reach a real social network. Point it at your public media " +
        "origin (the same value as S3_PUBLIC_READ_URL).",
    );
  }
  if (isLoopback(v.WEB_URL)) {
    reject("WEB_URL", "must be the public origin of the web app in production, not localhost.");
  }
  if (isLoopback(v.API_URL)) {
    reject(
      "API_URL",
      "must be a public https origin in production — it builds the OAuth redirect_uri registered " +
        "with Meta and TikTok, and a mismatch fails the connect flow with redirect_uri_mismatch.",
    );
  }
  if (isLoopback(v.BETTER_AUTH_URL)) {
    reject(
      "BETTER_AUTH_URL",
      "must be set to the public origin the browser reaches Better Auth on. Left unset, " +
        "verification and password-reset links point at localhost.",
    );
  }
  // Skipped when RESEND_API_KEY is set: mail then goes over HTTPS and the SMTP settings are unused,
  // so a leftover localhost host is harmless rather than fatal.
  if (!v.RESEND_API_KEY && isLoopback(v.SMTP_HOST)) {
    reject(
      "SMTP_HOST",
      "requireEmailVerification is enabled, so production needs a real mail transport — otherwise " +
        "no account can ever complete signup. Set RESEND_API_KEY to send over HTTPS (required on " +
        "hosts that block outbound SMTP, Render among them), or point SMTP_HOST at a real server.",
    );
  }
  if (v.AUTH_COOKIE_SAME_SITE === "none" && !v.API_URL.startsWith("https://")) {
    reject("AUTH_COOKIE_SAME_SITE", "SameSite=None requires Secure, which requires https.");
  }
  if (v.AUTH_COOKIE_DOMAIN && !v.AUTH_COOKIE_DOMAIN.startsWith(".")) {
    reject(
      "AUTH_COOKIE_DOMAIN",
      'must be a leading-dot parent domain such as ".example.com" to be shared across subdomains.',
    );
  }
  // R2 signs the Host header, so a presigned URL is bound to the account endpoint and cannot be
  // re-hosted. S3_PUBLIC_READ_URL is the correct knob for a custom media domain.
  if (
    v.S3_ENDPOINT.includes("r2.cloudflarestorage.com") &&
    v.S3_PUBLIC_URL &&
    v.S3_PUBLIC_URL !== v.S3_ENDPOINT
  ) {
    reject(
      "S3_PUBLIC_URL",
      "Cloudflare R2 presigned URLs are bound to the S3 API host and cannot be rehosted on a " +
        "custom domain (host is a signed header). Leave S3_PUBLIC_URL unset and use " +
        "S3_PUBLIC_READ_URL for public reads.",
    );
  }
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return parsed.data;
}

/** Comma-separated origin list → trimmed array, with WEB_URL as the single-origin fallback. */
function resolveOrigins(): string[] {
  const raw = process.env.TRUSTED_ORIGINS ?? process.env.WEB_URL ?? "http://localhost:3000";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export default () => ({
  env: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? process.env.API_PORT ?? "4000", 10),
  apiUrl: process.env.API_URL ?? "http://localhost:4000",
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
  corsOrigins: resolveOrigins(),
  enableSwagger: process.env.ENABLE_SWAGGER === "true",
  database: { url: process.env.DATABASE_URL },
  redis: { url: process.env.REDIS_URL },
  auth: {
    betterAuthSecret: process.env.BETTER_AUTH_SECRET,
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",
  },
  mail: {
    host: process.env.SMTP_HOST ?? "localhost",
    port: parseInt(process.env.SMTP_PORT ?? "1025", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "no-reply@socialplatform.dev",
    // Present means lib/email.ts sends over HTTPS and ignores every SMTP field above.
    resendApiKey: process.env.RESEND_API_KEY,
  },
  storage: {
    endpoint: process.env.S3_ENDPOINT,
    // The host presigned URLs are handed to the browser on. Only differs from `endpoint` when the
    // API and the browser reach storage by different names (MinIO in Docker).
    signingOrigin: process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT,
    // The host unsigned public reads are served from. Bucket-rooted.
    publicReadOrigin: process.env.S3_PUBLIC_READ_URL || process.env.MEDIA_PUBLIC_BASE_URL || "",
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET,
    // Unset must mean `true`: both MinIO and R2 want path-style. Reading `=== "true"` directly
    // would silently make the unset case `false`.
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
  },
  media: {
    publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL || "",
    maxUploadBytes: parseInt(process.env.MEDIA_MAX_UPLOAD_BYTES ?? String(1024 * 1024 * 1024), 10),
    signedUrlTtlSeconds: parseInt(process.env.MEDIA_SIGNED_URL_TTL_SECONDS ?? "3600", 10),
  },
  encryptionKey: process.env.ENCRYPTION_KEY,
  ai: { anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "" },
  social: {
    facebook: {
      appId: process.env.FACEBOOK_APP_ID ?? "",
      appSecret: process.env.FACEBOOK_APP_SECRET ?? "",
      graphVersion: process.env.FACEBOOK_GRAPH_VERSION ?? "v23.0",
    },
    tiktok: {
      clientKey: process.env.TIKTOK_CLIENT_KEY ?? "",
      clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? "",
    },
  },
});
