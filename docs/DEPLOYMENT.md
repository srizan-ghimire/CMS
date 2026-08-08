# Deployment

Target stack: **Render** (API + web + Postgres + Redis) and **Cloudflare R2** (media), with
**Resend** for outbound mail.

The blueprint is [`render.yaml`](../render.yaml) at the repo root.

---

## Why a deployment is required at all

Facebook and TikTok will not accept `localhost` as an OAuth redirect URI, so the social connect flow
cannot be exercised until the API has a public HTTPS origin. That origin becomes `API_URL`, and the
two callbacks you register are:

```
{API_URL}/api/v1/social-accounts/facebook/callback
{API_URL}/api/v1/social-accounts/tiktok/callback
```

## The three URLs

Getting these confused is the most common cause of a deployment that boots fine and then fails at
the first real interaction.

| Variable | Set to | Consumed by |
|---|---|---|
| `API_URL` | public origin of the API | builds the OAuth `redirect_uri` registered with Meta/TikTok |
| `WEB_URL` | public origin of the web app | CORS, and the origin the OAuth callback redirects back to |
| `BETTER_AUTH_URL` | origin the **browser** reaches Better Auth on | email verification and password-reset links |

`BETTER_AUTH_URL` is the subtle one. If the browser talks to the API directly it equals `API_URL`.
If the browser reaches the API through the web app's rewrites it equals `WEB_URL` — otherwise
verification links land on a host the session cookie was never set for.

## Cookie topology — decide this first

`apps/web/src/middleware.ts` reads the session cookie from the **web** origin to make optimistic
redirects. If that cookie is host-only to the API's hostname it is never sent to the web app, and
every dashboard route redirect-loops to `/login` even with a valid session. Two configurations work:

**A. Sibling subdomains (recommended).** `app.example.com` + `api.example.com`, cookie scoped to the
shared parent. First-party, `SameSite=Lax`, no proxy hop.

```
AUTH_COOKIE_DOMAIN=.example.com
AUTH_COOKIE_SAME_SITE=lax
BETTER_AUTH_URL=https://api.example.com
NEXT_PUBLIC_API_URL=https://api.example.com     # build arg on the web service
TRUSTED_ORIGINS=https://app.example.com
```

**B. Same-origin proxy.** No custom domain needed. The browser only ever talks to the web host; the
rewrites in `next.config.mjs` forward `/api/auth/*` and `/api/v1/*` to the API over Render's
internal network.

```
AUTH_COOKIE_DOMAIN=                              # empty
AUTH_COOKIE_SAME_SITE=lax
BETTER_AUTH_URL=https://social-platform-web.onrender.com
NEXT_PUBLIC_API_URL=                             # empty == same-origin
TRUSTED_ORIGINS=https://social-platform-web.onrender.com
```

> **`.onrender.com` cannot be a cookie domain.** It is on the Public Suffix List, so browsers reject
> `Set-Cookie; Domain=.onrender.com` outright, and two `*.onrender.com` hosts are cross-site to each
> other. Without a custom domain, option B is the only one that works.

Switching between them later is an env change plus a **rebuild** of the web service —
`NEXT_PUBLIC_API_URL` is inlined at build time.

---

## 1. Prerequisites

- A GitHub repo Render can watch.
- A Render account. The blueprint deploys entirely on free plans; read
  [Render's free tier](#renders-free-tier) for what that costs you.
- A Cloudflare account (R2 has a free tier that is genuinely usable).
- A domain, if you want option A, TikTok photo posts, or a production-grade media origin.
- A [Resend](https://resend.com) account with a verified sending domain.

## 2. Generate secrets

```bash
openssl rand -hex 32      # ENCRYPTION_KEY — must be exactly 64 hex chars
openssl rand -base64 32   # BETTER_AUTH_SECRET / JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
```

`ENCRYPTION_KEY` encrypts every stored social OAuth token at rest (AES-256-GCM). Rotating it makes
every existing `SocialAccount` token undecryptable — accounts must be reconnected.

The blueprint uses `generateValue: true` for the three auth secrets but deliberately **not** for
`ENCRYPTION_KEY`: Render emits base64, and the config schema requires hex.

## 3. Cloudflare R2

1. **Create a bucket**, e.g. `social-platform-media`.
2. **Create an API token** — R2 → Manage API Tokens → *Object Read & Write*, scoped to that bucket.
   Record the Access Key ID, Secret Access Key, and your account ID.
3. **Connect a custom domain** — bucket → Settings → Public access → Connect Domain, e.g.
   `media.example.com`. Cloudflare adds the DNS record for you.
4. **Set the bucket CORS policy** — bucket → Settings → CORS Policy. The browser uploads directly to
   a presigned PUT, so without this every upload fails:

```json
[
  {
    "AllowedOrigins": ["https://app.example.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

`Content-Type` in `AllowedHeaders` is mandatory: `presignPut` signs the content type into the
signature, which forces a preflight. Omitting it produces exactly the
`"Upload failed — check the storage CORS configuration."` error the client already reports.

Then the variables:

| Variable | Value |
|---|---|
| `S3_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `social-platform-media` |
| `S3_FORCE_PATH_STYLE` | `true` |
| `S3_PUBLIC_URL` | **leave unset** |
| `S3_PUBLIC_READ_URL` | `https://media.example.com` |
| `MEDIA_PUBLIC_BASE_URL` | `https://media.example.com` (same value) |

> **Do not set `S3_PUBLIC_URL` on R2.** It exists so MinIO-in-Docker can hand the browser a
> different host than the API used. R2 signs the `Host` header, so rewriting a presigned URL's
> origin yields `SignatureDoesNotMatch`. The app rejects this combination at boot rather than
> letting you discover it at the first upload.

`MEDIA_PUBLIC_BASE_URL` is what selects the real publishers. Unset, every platform falls back to
`StubPublisher` and posts are recorded as published without ever leaving the building — so the API
**refuses to start** in production without it.

## 4. Resend

Verify your sending domain, create an API key, then:

```
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false          # 587 is STARTTLS; only 465 is implicit TLS
SMTP_USER=resend
SMTP_PASS=<your API key>
SMTP_FROM=no-reply@example.com
```

Signup is gated by `requireEmailVerification: true`, so a broken transport means nobody can create
an account. The config schema rejects a loopback `SMTP_HOST` in production for that reason.

## 5. Deploy the blueprint

Render assigns hostnames only after the first deploy, and `fromService` exposes internal host/port
rather than public URLs — so this takes two passes.

**Pass 1.** Push `render.yaml`, then Render Dashboard → New → Blueprint → pick the repo. Fill in the
`sync: false` prompts you already know (R2, Resend, `ENCRYPTION_KEY`). Leave the URL variables
blank for now. Apply.

**Pass 2.** Note the two assigned URLs, then on the **API** service set `API_URL`, `WEB_URL`,
`BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, and `AUTH_COOKIE_DOMAIN` per your chosen topology. On the
**web** service set `NEXT_PUBLIC_API_URL`. Save.

**Redeploy the web service manually.** `NEXT_PUBLIC_API_URL` is a build argument; an env change
alone does not reach the already-built client bundle.

Migrations run from the container entrypoint (`prisma migrate deploy`, guarded by an advisory lock
so concurrent instances serialise). Watch for `==> prisma migrate deploy` in the API logs. On a paid
plan you can move this to `preDeployCommand` and set `RUN_MIGRATIONS_ON_BOOT=false` — never both.

### Custom domains

Render → service → Settings → Custom Domains. Point `app.example.com` at the web service and
`api.example.com` at the API, update the four URL variables, then rebuild web.

## 6. Meta app (Facebook **and** Instagram)

1. developers.facebook.com → Create App → **Business**.
2. Add products: **Facebook Login** and **Instagram Graph API**.
3. Facebook Login → Settings → Valid OAuth Redirect URIs:
   `https://api.example.com/api/v1/social-accounts/facebook/callback`
4. App Domains: `example.com`.
5. Set `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`.

Scopes requested by the provider: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
`pages_manage_metadata`, `instagram_basic`, `instagram_content_publish`, `business_management`.

> **There is no separate Instagram connect flow, by design.** Meta does not offer standalone
> Instagram OAuth for professional accounts — a single Facebook grant discovers every Instagram
> Business account linked to a Page you manage and creates those rows in the same callback. The
> Instagram account must be Business or Creator and linked to a Page you administer.

`pages_manage_posts` and `instagram_content_publish` require **App Review plus business
verification**, which takes days to weeks. Until then the app works in Development Mode for any
account holding a role on it — do the first end-to-end test with a tester account.

## 6b. Google / GitHub sign-in (optional)

This is user *login*, unrelated to connecting social accounts for publishing. It is entirely
optional: a provider is registered only when its client ID is set, and the sign-in page asks
`GET /api/v1/auth/providers` which ones exist — so leaving these blank hides the buttons rather
than showing ones that 404.

Register the authorized redirect URI against **`BETTER_AUTH_URL`**, which is the origin the browser
reaches Better Auth on — not necessarily `API_URL`:

```
{BETTER_AUTH_URL}/api/auth/callback/google
{BETTER_AUTH_URL}/api/auth/callback/github
```

- **Google** — console.cloud.google.com → APIs & Services → Credentials → OAuth client ID (Web).
  Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- **GitHub** — Settings → Developer settings → OAuth Apps. Set `GITHUB_CLIENT_ID` /
  `GITHUB_CLIENT_SECRET`.

Users arriving this way skip email verification — the provider has already proven the address.

## 7. TikTok app

1. developers.tiktok.com → Manage apps → your app → add **Login Kit** and **Content Posting API**.
2. Login Kit (Web) → Redirect URI:
   `https://api.example.com/api/v1/social-accounts/tiktok/callback`
   Must be absolute HTTPS, static, and carry no query string.
3. Scopes: `user.info.basic`, `user.info.profile`, `video.publish`.
4. Set `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`.

**URL property verification** — required only for *photo* posts, which are published with
`PULL_FROM_URL` and therefore need the media prefix verified under Manage URL Properties. Verify
`https://media.example.com`. Video posts upload their bytes directly and need none of this. An
`r2.dev` subdomain cannot be verified, which is one of the reasons to use a custom media domain.

TikTok's PKCE uses a **hex** S256 digest rather than the usual base64url; `lib/pkce.util.ts` already
implements it that way, matching TikTok's spec.

---

## Post-deploy verification

Work through these in order — each one proves a distinct piece of the configuration.

1. `curl https://api.example.com/health` returns ok with the database indicator up.
2. The API startup logs contain **no** `MEDIA_PUBLIC_BASE_URL is not set` warning. If they do,
   publishing is fake.
3. Sign up. The Resend verification email arrives, and the link lands you on `/dashboard`.
4. **Hard-reload `/dashboard` directly.** This is the cookie test — it proves `middleware.ts` on the
   web origin can see the session. A redirect to `/login` here means the cookie topology is wrong.
5. Upload an image in `/media` and confirm the thumbnail renders. Proves R2 CORS, the presigned PUT,
   and `publicUrl()` together.
6. `/settings/connections` → Connect Facebook. Both the Page **and** its linked Instagram account
   should appear from the one grant.
7. Connect TikTok.
8. Publish a real post. Confirm it on the platform, and that the `PublishAttempt` row carries a real
   external id rather than a `stub-*` one.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `/dashboard` redirect-loops to `/login` despite a valid session | Cookie not visible on the web origin. Set `AUTH_COOKIE_DOMAIN` to the shared parent, or switch to the same-origin proxy. |
| API refuses to start, naming `MEDIA_PUBLIC_BASE_URL` | Working as intended — set it, or you would be fake-publishing. |
| `SignatureDoesNotMatch` on upload | `S3_PUBLIC_URL` is set on R2. Unset it; use `S3_PUBLIC_READ_URL`. |
| `Upload failed — check the storage CORS configuration` | R2 bucket CORS missing, or `Content-Type` absent from `AllowedHeaders`. |
| 401 on every API call | Origin missing from `TRUSTED_ORIGINS`, or a `SameSite`/`Secure` mismatch. |
| Every publish succeeds instantly with a `stub-*` id | `MEDIA_PUBLIC_BASE_URL` unset. |
| All traffic rate-limited as one client | `trust proxy` not applied — check `NODE_ENV=production`. |
| `redirect_uri_mismatch` from Meta/TikTok | `API_URL` does not exactly match the registered URI (scheme, host, trailing slash). |
| Client still calls `localhost:4000` in production | The web image was built without `NEXT_PUBLIC_API_URL`. Rebuild, don't restart. |
| Google/GitHub sign-in lands on a 404 after consent | `callbackURL` must be absolute on the web origin, and that origin must be in `TRUSTED_ORIGINS`. |
| Social sign-in buttons never appear | Working as intended — those providers have no credentials set. Check `GET /api/v1/auth/providers`. |
| Scheduled posts never fire | The API instance is spun down, or Key Value `maxmemoryPolicy` is not `noeviction`. |
| Migration half-applied (`P3009`) | Usually the tsvector generated columns — see the `@default(dbgenerated())` note in `CLAUDE.md`. |

## Render's free tier

`render.yaml` ships with every service on `plan: free`, so a Blueprint deploy needs no payment
method on file. That buys a genuine demo deployment, and costs the following. None of it is
configurable away — the only fix is upgrading the plan named in the table.

| Limit | Effect here | Upgrade |
|---|---|---|
| Web services spin down after 15 min idle | First request after a sleep waits ~30–60s on a Docker cold start | `plan: starter` on the service |
| BullMQ does not run while asleep | **Scheduled posts fire late or not at all.** Publish-now still works, because the request itself wakes the instance | `plan: starter` on the API |
| Cold start can exceed the 10-min `OAuthState` TTL | "Connect account" occasionally fails mid-redirect and needs a retry | `plan: starter` on the API |
| Free Postgres expires 30 days after creation | The database and its data are deleted. One free Postgres per workspace | `plan: basic-256mb` |
| Free Key Value is 25 MB with no persistence | The keyspace is wiped on every restart and deploy, taking queued jobs with it. Posts stay `SCHEDULED` in Postgres so they can be re-scheduled by hand, but nothing replays automatically | `plan: starter` |
| 750 free instance-hours/month, shared across all free web services | Two always-on free services would exhaust it mid-month. Letting them sleep is what keeps this inside the allowance — so don't point an uptime pinger at both | — |
| No `preDeployCommand` (paid only) | None — migrations already run from the container entrypoint, which is why `RUN_MIGRATIONS_ON_BOOT=true` | — |

Everything outside Render is unchanged: R2, Resend and the Meta/TikTok apps all have usable free
tiers, and the API still refuses to boot in production without `MEDIA_PUBLIC_BASE_URL`, SMTP
credentials and a 64-hex-character `ENCRYPTION_KEY`.

## Operations

- **Rollback**: Render → service → Deploys → Rollback. Note that Prisma has no down migrations, so a
  schema change is forward-only — a rollback of application code does not undo the schema.
- **Rotating `ENCRYPTION_KEY`** invalidates every stored OAuth token; all accounts must reconnect.
- **Redis `maxmemoryPolicy` must stay `noeviction`.** Render defaults to `allkeys-lru`, which
  silently evicts BullMQ job hashes under memory pressure.
