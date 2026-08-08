# Social Platform

A production-track social media management platform (Buffer/Hootsuite-class): unified composer,
multi-platform publishing, scheduling, analytics, and AI content tools.

This is **Phase 1**: monorepo scaffolding, architecture, and the full data model. Feature logic
lands in later phases — see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the phase map.

## Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand
- **Backend**: NestJS, Prisma, PostgreSQL, Redis, BullMQ
- **Auth**: Better Auth (email/password, Google, GitHub, MFA, sessions/devices)
- **Storage**: S3-compatible (MinIO locally)
- **AI**: LangGraph orchestration (added in Phase 8)

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable` will pick up the pinned version from `package.json`)
- Docker (for Postgres/Redis/MinIO/Mailhog)

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Start infra (Postgres, Redis, MinIO, Mailhog)
pnpm docker:up

# 3. Configure environment (Prisma and Nest read .env from apps/api's working directory,
#    not the repo root — so each app gets its own file)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# edit apps/api/.env — at minimum set BETTER_AUTH_SECRET, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
# and ENCRYPTION_KEY (generate each with: openssl rand -hex 32)

# 4. Generate the Prisma client and run migrations
pnpm db:generate
pnpm db:migrate

# 5. Run everything
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api
- Swagger docs: http://localhost:4000/api/docs
- API health check: http://localhost:4000/health
- MinIO console: http://localhost:9001 (user/pass: `social_minio` / `social_minio_secret`)
- Mailhog UI: http://localhost:8025

## Auth (Phase 2)

Sign-up requires email verification by default. In dev, verification and password-reset emails
go to Mailhog — open http://localhost:8025 to read them and click through (nothing is sent to a
real inbox). Google/GitHub OAuth are optional locally: leave `GOOGLE_CLIENT_ID` /
`GITHUB_CLIENT_ID` blank in `apps/api/.env` and those sign-in buttons simply won't do anything
useful until you add real OAuth app credentials. `BETTER_AUTH_SECRET`, `JWT_ACCESS_SECRET`, and
`JWT_REFRESH_SECRET` must be set to real random values — Better Auth won't boot with a placeholder.
2FA can be enabled per-user from **Settings → Security** once signed in; scan the shown TOTP URI
with any authenticator app (Google Authenticator, 1Password, Authy).

## Seed data (Phase 3)

`pnpm db:migrate` applies migrations and then automatically runs the seed script (configured via
`prisma.seed` in `apps/api/package.json`); run it standalone any time with `pnpm db:seed`. It's
idempotent — safe to re-run. It creates:

- Two plans (`Free`, `Pro`) and one disabled feature flag (`ai_agents`)
- A demo user, created through Better Auth's real signup flow (so its password hash is valid) and
  marked as verified so you can log in immediately without digging a link out of Mailhog:
  **`demo@socialplatform.dev` / `DemoPassword123`**
- A "Demo Workspace" owned by that user on the `Pro` plan

## Social account connections (Phase 4)

From **Settings → Connections**, a workspace `OWNER`/`ADMIN`/`MANAGER` can connect Facebook Pages
(which auto-discovers any linked Instagram Business account in the same step) and TikTok accounts.
`ENCRYPTION_KEY` must be set (see above) — the app won't boot without it, since it's what encrypts
every stored access/refresh token.

**Facebook & Instagram** — one Meta app covers both:
1. Create an app at https://developers.facebook.com/apps (type: "Business").
2. Add the **Facebook Login** product. Under its settings, add this Valid OAuth Redirect URI:
   `{API_URL}/api/v1/social-accounts/facebook/callback` (`http://localhost:4000/api/v1/social-accounts/facebook/callback` locally).
3. In **App Review → Permissions**, request `pages_show_list`, `pages_read_engagement`,
   `pages_manage_posts`, `pages_manage_metadata`, `instagram_basic`, `instagram_content_publish`,
   and `business_management`. While the app is in Development Mode, any Facebook user added as a
   Tester/Developer on the app can authorize it without going through review.
4. Copy the App ID/Secret into `apps/api/.env` as `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET`.
5. To test Instagram, the Instagram account must be a **Business or Creator account** linked to a
   Facebook Page you manage — personal Instagram accounts aren't supported by the Graph API.

**TikTok**:
1. Create an app at https://developers.tiktok.com/apps and add the **Login Kit** product.
2. Under Login Kit → Web, add this redirect URI:
   `{API_URL}/api/v1/social-accounts/tiktok/callback` (`http://localhost:4000/api/v1/social-accounts/tiktok/callback` locally).
3. Request scopes `user.info.basic`, `user.info.profile`, and `video.publish` (the latter needs
   the **Content Posting API** product, used for actual publishing in Phase 5).
4. Copy the Client Key/Secret into `apps/api/.env` as `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET`.
5. Unaudited TikTok apps only work for accounts added as testers in the developer portal — that's
   normal for local development.

A background job re-checks connections every 6 hours and flags anything expiring within 3 days
(TikTok's tokens rotate on a schedule; Facebook/Instagram Page tokens don't expire on their own, so
they're only ever re-checked when you click **Refresh** or a publish call actually fails).

## Monorepo scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run all apps in watch mode via Turborepo |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint all apps/packages |
| `pnpm typecheck` | Type-check all apps/packages |
| `pnpm test` | Run unit tests |
| `pnpm db:studio` | Open Prisma Studio |

## Project structure

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full layout and module boundaries.

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and are enforced by
commitlint via a Husky `commit-msg` hook. Staged files are linted/formatted via `lint-staged` on
`pre-commit`.
