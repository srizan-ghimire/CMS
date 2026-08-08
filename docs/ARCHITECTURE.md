# Architecture

## Monorepo layout

```
social-media-platform/
├── apps/
│   ├── api/                 NestJS backend
│   │   ├── src/
│   │   │   ├── common/       filters, guards, interceptors, decorators, pipes
│   │   │   ├── config/       env loading + Zod validation
│   │   │   ├── prisma/       PrismaService + PrismaModule (global)
│   │   │   └── modules/      one folder per domain (feature-based, not layer-based)
│   │   └── prisma/schema.prisma
│   └── web/                 Next.js 15 App Router frontend
│       └── src/
│           ├── app/          (marketing) (auth) (dashboard) route groups
│           ├── components/   ui/ (shadcn primitives) + dashboard/ (feature components)
│           ├── hooks/, lib/, store/  (Zustand)
├── packages/
│   ├── shared/               Zod schemas + enums shared by web and api (single source of truth for the API contract)
│   └── config/               shared tsconfig
└── docker-compose.yml        Postgres, Redis, MinIO (S3-compatible), Mailhog
```

## Why feature-based modules

Each backend domain (`auth`, `workspaces`, `posts`, `scheduling`, `media`, `analytics`, `ai`,
`notifications`, `admin`, `search`, `social-accounts`) is a self-contained Nest module: its own
controller, service, DTOs, and (as they're added) queue processors and guards. Modules depend on
`PrismaModule` (global) and on each other only through exported services — never by reaching into
another module's internals. This keeps the dependency graph a DAG and each module independently
testable.

## Data model

`apps/api/prisma/schema.prisma` is the single source of truth for persistence. Key relations:

- `User` → `Session`, `Account` (Better Auth-compatible: credentials + OAuth identities in one table)
- `Workspace` → `WorkspaceMember` (join table carrying `WorkspaceRole`) → RBAC
- `Workspace` → `SocialAccount` → `PostTarget` (join between a `Post` and the accounts it publishes to)
- `Post` → `PostVersion` (edit history), `PostApproval` (review workflow), `Comment`
- `MediaFolder` / `MediaAsset` — hierarchical library scoped to a workspace
- `AnalyticsSnapshot` — time-series rows written by scheduled jobs, one per social account per capture
- `AuditLog`, `FeatureFlag` — admin/ops tables

All content tables carry `createdAt`/`updatedAt`; user- and workspace-facing tables that need
recovery (`User`, `Workspace`, `Post`) also carry `deletedAt` for soft deletes.

## Request lifecycle (API)

`main.ts` wires, in order: Helmet → CORS → URI versioning (`/api/v1/...`) → global
`ValidationPipe` (whitelist + transform) → global exception filter → Swagger at `/api/docs`.
`ThrottlerGuard` is registered as an `APP_GUARD` for baseline rate limiting; per-route overrides
come later per endpoint sensitivity (e.g. stricter limits on auth endpoints in Phase 2).

## Background work

`BullModule` is configured at the root against Redis. Each domain that needs async work (publishing,
token refresh, analytics polling, AI generation) will register its own queue + processor inside its
own module in the relevant phase, rather than a single global "jobs" module — so queue concerns stay
next to the domain that owns them.

## Frontend structure

Route groups separate concerns without affecting the URL: `(marketing)` is the public site,
`(auth)` holds unauthenticated flows, `(dashboard)` is the authenticated app shell (sidebar + topbar
in `layout.tsx`). Server state (posts, accounts, analytics) is fetched via TanStack Query; local UI
state (composer draft, calendar view, command palette open/closed) lives in Zustand stores under
`src/store`. `packages/shared` Zod schemas are imported on both sides so a form validated client-side
with `zod-resolver` and a NestJS DTO validated server-side stay in lockstep.

## Roadmap (phase → module)

| Phase | Scope |
|---|---|
| 1 | Scaffolding, architecture, Prisma schema |
| 2 | `auth`, `users` — Better Auth (email/password, Google/GitHub OAuth, email verification, password reset, TOTP 2FA, session/device list+revoke) — **done** |
| 3 | Database migrations, seed data — **done** |
| 4 | `social-accounts` — Facebook/Instagram/TikTok OAuth, token storage/refresh — **done** |
| 5 | `media` — S3/MinIO presigned upload, sharp renditions, folders, alt text — **done** |
| 5 | `posts` — composer, per-platform overrides, ordered media, validation — **done** |
| 6 | `organization` — tags, campaigns, templates, snippets; `search` — Postgres FTS — **done** |
| 7 | Versioning, approval workflow, threaded comments — **done** |
| 8 | Publish pipeline — provider registry, BullMQ queue, retries, idempotency — **done** |
| 9 | `scheduling` — due-scan sweep, recurrence materialization, calendar — **done** |
| 10 | `analytics` — content volume + delivery reliability — **done** (engagement metrics deferred) |
| 11 | `ai` — caption/hashtag assist behind a feature flag — **done** (LangGraph agents deferred) |
| 12 | `notifications` delivery, `workspaces` CRUD/invitations/RBAC admin — **done** |
| 13 | `admin` — plans, feature flags, audit log viewer, queue monitoring — **done** |
| 14 | Deployment (Docker images, CI/CD, observability) |

Testing is no longer a separate phase: `apps/api/jest.config.js` exists and each stage above
shipped with unit tests plus a scripted end-to-end pass against a live stack.

## Authentication (Phase 2)

Auth is Better Auth, mounted into NestJS via the community package `@thallesp/nestjs-better-auth`
(`apps/api/src/modules/auth/lib/auth.ts` is the Better Auth instance; `AppModule` registers it with
`AuthModule.forRoot({ auth })`). That registration does two things: it mounts every Better Auth
route under `/api/auth/*` (sign-up, sign-in, sign-out, verify-email, forget-password,
reset-password, 2FA enable/verify/disable, list-sessions, revoke-session, OAuth callbacks — all
built in, none of it hand-written), and it installs a **global** `AuthGuard`, so every other route
in the app requires a session by default. Opt a route out with `@AllowAnonymous()` (fully public)
or `@OptionalAuth()` (session attached if present, request still allowed without one) from the same
package; grab the current user in a controller with `@Session() session: UserSession`.

Passwords, OAuth tokens, and 2FA secrets never touch our own domain tables — Better Auth owns
`User`, `Session`, `Account` (one row per sign-in method, including the password hash for the
`credential` provider), `Verification` (email/reset tokens), and `TwoFactor` (TOTP secret + backup
codes). We only added `deviceName` as a custom session field and moved `WorkspaceMember` etc. to
reference `User.id`, unchanged from Phase 1.

The frontend (`apps/web`) never talks to Prisma or holds a JWT — `src/lib/auth-client.ts` wraps
`better-auth/react`'s `createAuthClient`, pointed at the API's origin with `credentials: "include"`
since the two apps run on different ports in dev. `src/middleware.ts` does a cheap cookie-existence
check (`getSessionCookie`) to redirect optimistically before a page even renders; the real
authorization boundary is still the NestJS `AuthGuard` validating the session against the database
on every request — the middleware is a UX shortcut, not the security control.

## Social account connections (Phase 4)

`social-accounts` connects a workspace to the external accounts it publishes to. Two provider
implementations, one shared contract (`SocialOAuthProvider`):

- **Facebook** (`providers/facebook.provider.ts`) drives the standard OAuth code flow, exchanges
  the short-lived code for a long-lived (60-day) user token, then calls `/me/accounts` to list
  the Pages the user manages. Each Page's `access_token` (derived from the long-lived user token)
  doesn't expire on its own, so Facebook/Instagram accounts are stored with `tokenExpiresAt: null`
  and are excluded from the scheduled refresh sweep entirely.
- **Instagram** has no standalone OAuth product for professional accounts — Meta surfaces a
  linked Instagram Business/Creator account through its parent Facebook Page
  (`page.instagram_business_account`), and publishing to it uses that Page's access token. So
  the Facebook provider's `handleCallback` returns both `FACEBOOK` and `INSTAGRAM`
  `ConnectedAccountResult`s from a single grant — there's no separate "Connect Instagram" button.
- **TikTok** (`providers/tiktok.provider.ts`) uses Login Kit v2 with mandatory PKCE (S256, hex
  digest per TikTok's spec — not the base64url most providers use). Tokens rotate on a fixed
  schedule (`expires_in`/`refresh_token`), so TikTok accounts *are* covered by the refresh sweep.

**State across the redirect.** The connect → external consent screen → callback round-trip can't
rely on a session cookie surviving the hop cleanly, so `OAuthStateService` persists a short-lived,
single-use `OAuthState` row (10 min TTL) keyed by an opaque `state` value, carrying
`workspaceId`/`userId`/the PKCE `codeVerifier`. The callback route is `@AllowAnonymous()` — it
recovers all context from that row rather than trusting anything else on the inbound request, and
the row is deleted the moment it's read so a replayed `state` can never be reused.

**Tokens at rest.** `TokenCryptoService` encrypts every access/refresh token with AES-256-GCM
before it reaches Postgres (`ENCRYPTION_KEY`, 32 raw bytes) — the ciphertext, IV, and auth tag are
packed into the single `encryptedAccessToken`/`encryptedRefreshToken` string columns. Plaintext
tokens exist in memory only for the duration of a provider API call and are never logged.

**Refresh & expiry.** `TokenRefreshProcessor` runs a BullMQ repeatable job every 6 hours, sweeping
accounts whose `tokenExpiresAt` falls within the next 3 days (Facebook/Instagram, having no
expiry, are naturally excluded). A failed refresh flips the account to `TOKEN_EXPIRED` and drops a
`TOKEN_EXPIRING`-type `Notification` row for the workspace's owner/admins — the full in-app/
real-time notification *delivery* (WebSocket push, etc.) is Phase 9's `notifications` module; for
now these just land in the `notifications` table.

**Authorization.** Connecting or disconnecting an account requires `OWNER`/`ADMIN`/`MANAGER` on the
workspace (`WorkspaceMember.role`) — `WorkspacesService.listForUser`/`GET /workspaces/mine` is a
minimal read-only seam pulled forward from Phase 9 so workspace-scoped modules have something to
resolve "which workspaces can this user act in" against; full workspace CRUD/invites/RBAC
management still lands in Phase 9.

Disconnecting is a soft operation (`status: REVOKED`, tokens cleared) rather than a row delete —
`PostTarget` (Phase 5+) will reference `SocialAccount` rows for publish history, and reconnecting
the same external account resumes the same row via the `(workspaceId, platform,
externalAccountId)` unique constraint instead of creating a duplicate.


## Content model (Phase 5–7)

`Post` is composed once and delivered to N `PostTarget`s. The pieces that are easy to get wrong:

- **`Post.content` (plain text) and `Post.contentJson` (TipTap document) are stored side by side.**
  Plain text is the source of truth for publishing *and* for the search vector; the JSON exists so
  the editor round-trips links and formatting losslessly. `posts/lib/content-serializer.ts` is the
  single place the conversion happens, server-side on save, so the editor and the publish pipeline
  cannot disagree about what the caption says.
- **Media is a `PostMedia` join, not an array.** The former `Post.mediaAssetIds String[]` had no
  foreign key (deleting an asset left dangling ids) and encoded carousel order only implicitly.
- **Per-target overrides are the core CMS feature.** `PostTarget.contentOverride` /
  `platformOptions` / `PostTargetMedia` let one post read differently on LinkedIn than on TikTok.
  Null/absent means inherit; an empty string is a deliberate choice to publish nothing there.
- **Versions are append-only.** Every content edit writes a `PostVersion` inside the same
  transaction, carrying a full JSON `snapshot` (media order, overrides, tags, schedule). Restore
  writes a *new* version from an old snapshot rather than rewriting history.
- **Editing a post under review invalidates the round.** `Post.approvalRound` increments and the
  status drops back to `DRAFT`, so an approval can never carry over to text nobody reviewed.

## Full-text search (Phase 6)

Prisma's `@@fulltext` is MySQL-only, so this cannot be expressed in `schema.prisma`. The tsvector
columns are declared `Unsupported("tsvector")? @default(dbgenerated())` and created as
`GENERATED ... STORED` columns in a hand-written migration. Two consequences worth knowing:

- The database maintains the vector itself — no trigger, no application write path, so it cannot
  drift out of sync with the row.
- **Tags are deliberately not in the vector.** A generated column may only reference columns of its
  own row, and tags live in a join table. Tag filtering is an `EXISTS` join in `SearchService`.
  This is not an oversight and cannot be "fixed" by inlining tags.

`@default(dbgenerated())` matters: without it every `migrate diff` emits
`ALTER COLUMN "searchVector" DROP DEFAULT`, which Postgres rejects on a generated column and which
kills the migration mid-apply.

## Publish pipeline (Phase 8)

Lives at `modules/posts/publishing/` rather than in its own module: `PostTarget` belongs to posts,
and a separate module would create a `posts ↔ publishing` cycle. `scheduling` owns only the sweep
and the calendar, and reaches publishing through the exported `PublishingService`.

Defences against the two failure modes that actually matter:

**Double-posting.** Neither Meta nor TikTok offers a real idempotency key, so there are three
layers: BullMQ dedupes on `jobId` (`{idempotencyKey}-{publishRound}`, so a manual retry gets a
fresh job while an accidental re-enqueue is a silent no-op); the worker claims a target with a
guarded `updateMany` that only succeeds from `QUEUED`/`RETRYING`; and `containerId` is persisted
*before* the finalizing call so a lost response resumes an existing container instead of creating a
second one.

**Wasted or misattributed retries.** Platform-rule violations are caught by `validate()` at enqueue
time and become `SKIPPED` without consuming an attempt. Async platforms (Instagram video, TikTok
transcode) return `PENDING`, which re-queues with a delay and *gives the attempt back*. Credentials
are fetched at execution time, never snapshotted — a TikTok token rotates on a schedule and a post
scheduled two weeks out outlives the 3-day proactive refresh window.

**Local development.** Facebook and Instagram publish by handing Meta a URL that *Meta's servers*
fetch, so `http://localhost:9000` is unusable. When `MEDIA_PUBLIC_BASE_URL` is unset the provider
registry resolves every platform to `StubPublisher`, which exercises the same code paths (validate,
PENDING, configurable failure) without sending anything anywhere. This is what lets the whole
pipeline, the scheduler and the calendar be built and demonstrated before Meta App Review.


## Deliberately deferred

Two things are narrower than their module names imply. Both are stated at the API surface so the
gap is visible to callers rather than discovered later:

- **Engagement analytics.** Reach/impressions/likes require polling each platform's insights API on
  a schedule. `AnalyticsSnapshot` exists (account-level, with no FK to `SocialAccount` and no link
  to a post) and has never been written to. `AnalyticsService` therefore reports only what this
  platform observed itself: how much content exists, and how reliably each `PostTarget` reached its
  destination.
- **AI agents.** `AiService` is one Anthropic request/response for caption and hashtag suggestions,
  gated on both the `ai_agents` feature flag and `ANTHROPIC_API_KEY`. The roadmap's LangGraph
  strategist/planner agents are future work — a caption rewrite has no branching or tool use for a
  graph to orchestrate, so the graph would be machinery without a job.

Also outstanding: real Facebook/Instagram publishing has never run against the live Graph API. The
providers are written and the contract is exercised by `StubPublisher`, but proving them needs
`MEDIA_PUBLIC_BASE_URL` pointed at a public host *and* Meta App Review approval for
`pages_manage_posts` / `instagram_content_publish`.
