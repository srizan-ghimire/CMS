# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Buffer/Hootsuite-class social media management platform, and a working social content CMS: compose
once, override per platform, organize and search, route through approval, schedule, publish with
retries. See the roadmap in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Every module is implemented — there are no `GET ping` stubs left: `auth`, `users`,
`social-accounts`, `media`, `posts` (incl. `posts/publishing`), `organization`, `search`,
`scheduling`, `workspaces`, `notifications`, `analytics`, `admin`, `ai`.

Two capabilities are deliberately narrower than their module name suggests, and both say so at
their API surface rather than pretending otherwise:
- **`analytics`** reports content volume and *delivery reliability* from this platform's own
  publish record. It does **not** report reach/impressions/engagement — those need each platform's
  insights API, and `AnalyticsSnapshot` has never been populated. Empty or invented engagement
  numbers would be worse than none.
- **`ai`** is a single request/response caption assistant behind the `ai_agents` feature flag *and*
  an `ANTHROPIC_API_KEY`. The LangGraph multi-agent strategist in the roadmap remains future work —
  a caption rewrite has no branching or tool use for a graph to orchestrate.

## Commands

pnpm workspaces + Turborepo. Run from the repo root:

| Command | Notes |
|---|---|
| `pnpm dev` | Runs web (:3000) and api (:4000) in watch mode |
| `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test` | Fan out via turbo to all workspaces |
| `pnpm docker:up` / `docker:down` | Postgres :5432, Redis :6379, MinIO :9000 (console :9001), Mailhog :1025 (UI :8025) |
| `pnpm db:generate` | `prisma generate` — required after any schema edit and before `lint`/`build` |
| `pnpm db:migrate` | `prisma migrate dev` **and then runs the seed** (via `prisma.seed` in apps/api/package.json) |
| `pnpm db:deploy` | `prisma migrate deploy` — non-interactive, for CI and deployed environments |
| `pnpm db:seed` / `pnpm db:studio` | Seed is idempotent |

Scoping to one workspace: `pnpm --filter api <script>` / `pnpm --filter web <script>`.

Single test:
- API (Jest): `pnpm --filter api exec jest path/to/file.spec.ts -t "test name"`
- Web (Vitest): `pnpm --filter web exec vitest run path/to/file.test.tsx -t "test name"`

Tests live beside the code as `*.spec.ts`; config is `apps/api/jest.config.js`, which maps
`@social-platform/shared` to its source so tests don't need a prior build. CI
(`.github/workflows/ci.yml`) runs install → db:generate → lint → typecheck → build → test.

Env files are **per-app, not root** — Prisma and Nest read `.env` from `apps/api`'s cwd:
`cp apps/api/.env.example apps/api/.env` and `cp apps/web/.env.example apps/web/.env.local`.
The API will not boot without real values for `BETTER_AUTH_SECRET`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, and `ENCRYPTION_KEY` (64 hex chars). Every env var is Zod-validated in
[apps/api/src/config/configuration.ts](apps/api/src/config/configuration.ts) — a new var must be
added to `envSchema` there or startup throws.

Dev login after seeding: `demo@socialplatform.dev` / `DemoPassword123`. Other outbound mail lands in
Mailhog at http://localhost:8025, never a real inbox.

## Architecture

### Route surface (three different prefixes)
[apps/api/src/main.ts](apps/api/src/main.ts) sets a global `api` prefix with URI versioning at
default v1, so app endpoints are `/api/v1/...`. Two carve-outs: Better Auth mounts its own
unversioned routes at `/api/auth/*`, and `/health` is excluded from the prefix entirely. Swagger is
at `/api/docs`. Note `bodyParser: false` in `NestFactory.create` — Better Auth needs the raw body;
`@thallesp/nestjs-better-auth` re-adds express body parsing for every other route. Don't re-enable it.

### Auth is deny-by-default
`AuthModule.forRoot({ auth })` in [app.module.ts](apps/api/src/app.module.ts) installs a **global**
`AuthGuard`, so every route requires a session unless decorated `@AllowAnonymous()` or
`@OptionalAuth()` (both from `@thallesp/nestjs-better-auth`). Read the current user with
`@Session() session: UserSession`.

Better Auth owns `User`, `Session`, `Account`, `Verification`, `TwoFactor` — sign-up, OAuth,
email verification, password reset, TOTP 2FA, and session listing/revocation are all built-in routes,
not hand-written controllers. Never write password hashing or token issuance by hand; configure it in
[apps/api/src/modules/auth/lib/auth.ts](apps/api/src/modules/auth/lib/auth.ts).

On the web side, `src/middleware.ts` only does a cookie-existence check for optimistic redirects —
the real authorization boundary is always the API's `AuthGuard`. The frontend never holds a JWT and
never talks to Prisma; it calls the API with `credentials: "include"` (different origins in dev).

### Module conventions (API)
One folder per domain under `src/modules`, feature-based not layer-based: controller, service, DTOs,
`providers/`, `processors/`, `lib/`. Modules talk to each other only through exported services —
never by importing another module's internals. `PrismaModule` is global.

Workspace RBAC is currently enforced by a private `assertMembership(workspaceId, userId, roles)`
helper inside each service (see
[social-accounts.service.ts](apps/api/src/modules/social-accounts/social-accounts.service.ts)) —
there is no shared guard yet. It treats `Workspace.ownerId` as an implicit `OWNER` rather than
requiring a `WorkspaceMember` row. `WorkspacesService` now carries full CRUD plus members and
invitations — `create` derives a unique slug from the name and writes an explicit `OWNER`
membership row so the member list is one query.

### Background jobs
`BullModule.forRoot` is configured at the root against Redis, but each domain registers its **own**
queue and processor inside its own module (e.g. `TokenRefreshProcessor` in `social-accounts`) — do
not add a central "jobs" module.

### Social accounts (the one fully-built domain, and the template for the rest)
- `SocialPlatform` (8 platforms, in the Prisma schema and `packages/shared`) is distinct from
  `ConnectablePlatform` (`"facebook" | "tiktok"`) — the set that actually has an OAuth provider.
  Providers are resolved through a registry token, `SOCIAL_OAUTH_PROVIDERS`.
- **Instagram has no provider of its own.** A single Facebook grant returns both `FACEBOOK` and
  `INSTAGRAM` accounts (via `page.instagram_business_account`), and Instagram token
  refresh/revoke routes through the Facebook provider. Don't add a "Connect Instagram" flow.
- Facebook/Instagram accounts are stored with `tokenExpiresAt: null`, which is the marker for
  "no refresh possible" — the 6-hourly refresh sweep skips them by construction.
- TikTok uses PKCE with a **hex** S256 digest (TikTok's spec), not the usual base64url — see
  `lib/pkce.util.ts`.
- The OAuth round-trip carries no session. `OAuthStateService` persists a single-use, 10-minute
  `OAuthState` row holding workspaceId/userId/codeVerifier; the callback is `@AllowAnonymous()` and
  recovers everything from that row, deleting it on read. Trust nothing else on the inbound request.
- Every stored token is AES-256-GCM encrypted by `TokenCryptoService` before it reaches Postgres.
  Plaintext exists only for the duration of a provider call and is never logged.
- Disconnect is soft (`status: REVOKED`, tokens cleared), and reconnecting resumes the same row via
  the `(workspaceId, platform, externalAccountId)` unique constraint — publish history will point at
  these rows.

### Shared contract
`packages/shared` holds Zod schemas and const-object enums used by both sides so a react-hook-form
resolver and a NestJS DTO can't drift. Enum values there mirror the Prisma enums by hand — change
both together.

**It has a real build step.** `main`/`types` point at `dist/`, so anything that consumes it must be
built with turbo's dependency-aware form — `pnpm build --filter web...`, trailing `...` — and never
a bare `pnpm --filter web build`, which skips the dependency and fails on an unresolved import.
Jest is the one exception: `apps/api/jest.config.js` maps the package to its source so tests need
no prior build.

`apps/api/prisma/schema.prisma` is the single source of truth for persistence. Soft deletes
(`deletedAt`) exist on `User`, `Workspace`, `Post`; query paths must filter them.

### Frontend
Next.js 15 App Router with route groups `(marketing)` / `(auth)` / `(dashboard)` — the dashboard
group's `layout.tsx` is the authenticated shell. Server state via TanStack Query through
`src/lib/api-client.ts` (thin fetch wrapper, prefixes `/api/v1`, throws `ApiError`); local UI state
via Zustand in `src/store`. `src/lib/auth-client.ts` wraps `better-auth/react`.

## Conventions

- Prettier: double quotes, semicolons, trailing commas, `printWidth: 100`, plus
  `prettier-plugin-tailwindcss` for class ordering.
- ESLint enforces `@typescript-eslint/consistent-type-imports` (use `import type`) and warns on
  `console.*` except `warn`/`error` — the API logs through nestjs-pino (`Logger`), not console.
- TS is strict with `noUncheckedIndexedAccess`; `@/*` maps to each app's `src/*`.
- Conventional Commits, enforced by commitlint on a Husky `commit-msg` hook; `lint-staged` runs
  eslint --fix + prettier on `pre-commit`.
- Node ≥ 20, pnpm 9.7.0 via corepack.


## Things that will bite you

These are all load-bearing and none are obvious from the surrounding code.

**Never let `eslint --fix` rewrite an API import to `import type`.** NestJS resolves constructor
injection from `design:paramtypes`, which `emitDecoratorMetadata` can only emit if the injected
class is a *value* import. A type-only import erases the binding: the code still type-checks and
still builds, then fails at boot with "Nest can't resolve dependencies". `consistent-type-imports`
is therefore disabled for `apps/api/**` in `eslint.config.mjs`.

**BullMQ rejects `:` in queue and job names** — it uses the colon as its own Redis key separator.
Queue names here use hyphens (`posts-publish`, `media-processing`).

**Don't import the queue constants from a processor.** `publishing.constants.ts` exists because
`publishing.service.ts` and `publish.processor.ts` importing each other left the DI token
`undefined` at decoration time.

**`bodyParser: false` in `main.ts` is required by Better Auth** (it needs the raw stream on its own
routes). `main.ts` therefore adds `express.json()` explicitly for everything *except* `/api/auth`.
Remove that and every non-auth request body silently arrives as `undefined`.

**Controllers need `VERSION_NEUTRAL` to escape URI versioning.** Excluding a route from the global
`api` prefix does *not* exempt it from `/v1`. `/health` needs both.

**`@default(dbgenerated())` on the tsvector columns is not decorative.** Without it every
`migrate diff` emits `ALTER COLUMN ... DROP DEFAULT`, which Postgres rejects on a generated column,
and the migration dies half-applied.

**`analytics`/`ai` narrowness is intentional** — see Project above before "finishing" either.

**Regenerating the Prisma client fails while the API is running** — the query-engine DLL is locked
on Windows. Stop `pnpm dev` before `pnpm db:generate`.

**`NEXT_PUBLIC_*` is inlined at build time, not read at runtime.** In a container it must arrive as
a Docker build `ARG`; setting it on the running service changes nothing. Changing `NEXT_PUBLIC_API_URL`
therefore requires a rebuild, not a restart.

**The session cookie has to be visible on the *web* origin.** `apps/web/src/middleware.ts` reads it
to decide optimistic redirects, so a split-host deployment must set `AUTH_COOKIE_DOMAIN` to the
shared parent domain — otherwise every protected route redirect-loops to `/login` with a perfectly
valid session. `.onrender.com` and similar public suffixes can never be that parent.

**Rewriting a presigned URL's host only works on MinIO.** `StorageService.toSigningOrigin` exists
for the Docker case (api → `minio:9000`, browser → `localhost:9000`). Under real SigV4 `host` is a
signed header, so the same rewrite breaks R2 and S3 — there, leave `S3_PUBLIC_URL` unset and put the
public media domain in `S3_PUBLIC_READ_URL`. `configuration.ts` rejects the unsafe pairing at boot.

**Production config fails fast on purpose.** `configuration.ts` carries a `superRefine` that only
fires when `NODE_ENV=production`, rejecting localhost-shaped URLs, missing SMTP, and above all a
missing `MEDIA_PUBLIC_BASE_URL` — which would otherwise route every platform to `StubPublisher` and
report posts as published that never left the building.

## Authorization

One primitive: `WorkspacesService.assertMembership(workspaceId, userId, allowedRoles?)`. It treats
`Workspace.ownerId` as an implicit OWNER (the seed creates no membership row for the owner) and
returns the effective role so callers can vary behaviour without a second query. Capability sets
live in [apps/api/src/modules/workspaces/lib/roles.ts](apps/api/src/modules/workspaces/lib/roles.ts)
— use `CONTENT_CREATE_ROLES` etc. rather than spelling out role arrays. The common pattern is
"EDITORs may act on their own content, MANAGER+ on anyone's".

Every route is behind the global `AuthGuard`; the stub modules still carry `@AllowAnonymous()` and
must lose it when they gain real routes.

## Validation

New endpoints validate with shared Zod schemas via `zodPipe(schema)` from
`common/pipes/zod-validation.pipe.ts`. Schemas are `.strict()` so an unknown field is a 400 rather
than silently dropped — matching the `forbidNonWhitelisted: true` behaviour class-based DTOs get.
A typo'd filter must fail loudly, not return unfiltered results.

## Publishing locally

With `MEDIA_PUBLIC_BASE_URL` unset (the default), every platform resolves to `StubPublisher` and
nothing reaches a real social network — the API logs a warning saying so at boot. This is
deliberate: Facebook and Instagram publish by handing Meta a URL that Meta's servers fetch, so
localhost cannot work. Point `MEDIA_PUBLIC_BASE_URL` at a tunnel to MinIO for real smoke tests.

The seed creates three fake CONNECTED social accounts (Facebook Page, linked Instagram, TikTok) so
the composer, calendar and publish pipeline are all usable without any real credentials.

In production that same fallback would be a disaster, so it is unreachable there: both
`configuration.ts` and `publishProviderRegistryFactory` refuse to start without a real
`MEDIA_PUBLIC_BASE_URL`.

## Deploying

[render.yaml](render.yaml) is a Render blueprint (API + web as Docker services, managed Postgres and
Key Value), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) is the full runbook: Cloudflare R2 setup,
the cookie-topology decision, the Meta and TikTok app configuration with exact redirect URIs, and a
symptom→cause troubleshooting table. Read the cookie section before choosing hostnames.
