import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocsSection, DocsTable, Steps, Term } from "@/components/marketing/docs-parts";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "How to use Social Platform: workspaces and roles, connecting accounts, the composer, approvals, scheduling, publishing, and analytics.",
  alternates: { canonical: "/docs" },
};

const CONTENTS = [
  { id: "getting-started", n: "01", title: "Getting started" },
  { id: "workspaces", n: "02", title: "Workspaces & roles" },
  { id: "connections", n: "03", title: "Connecting accounts" },
  { id: "media", n: "04", title: "Media library" },
  { id: "composer", n: "05", title: "The composer" },
  { id: "limits", n: "06", title: "Platform limits" },
  { id: "approvals", n: "07", title: "Approvals" },
  { id: "history", n: "08", title: "Versions & comments" },
  { id: "scheduling", n: "09", title: "Scheduling & calendar" },
  { id: "publishing", n: "10", title: "Publishing & retries" },
  { id: "organizing", n: "11", title: "Campaigns, tags & templates" },
  { id: "analytics", n: "12", title: "Analytics" },
  { id: "notifications", n: "13", title: "Notifications" },
  { id: "security", n: "14", title: "Account security" },
  { id: "scope", n: "15", title: "Limits & what's missing" },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
      <header className="border-b border-border py-16 lg:py-24">
        <p className="marker text-muted-foreground">Documentation</p>
        <h1 className="display-tight mt-6 max-w-3xl text-5xl sm:text-6xl">
          Everything the platform does, in the order you&apos;ll need it.
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Written against the product as it actually behaves — including the parts that are narrower
          than they sound. Read top to bottom the first time; after that, use the contents.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-12 lg:gap-x-12">
        <aside className="border-b border-border py-8 lg:col-span-3 lg:border-b-0 lg:border-r lg:py-14 lg:pr-8">
          <nav aria-label="Contents" className="lg:sticky lg:top-24">
            <p className="marker text-muted-foreground">Contents</p>
            <ol className="mt-5 space-y-2.5">
              {CONTENTS.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="group flex gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className="marker mt-0.5 tabular-nums">{item.n}</span>
                    <span>{item.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <main className="lg:col-span-9 lg:py-14">
          {/* ------------------------------------------------------- 01 ---- */}
          <DocsSection
            id="getting-started"
            n="01"
            title="Getting started"
            lede="Three things stand between a new account and a published post: verify your email, create a workspace, connect an account."
          >
            <Steps
              items={[
                <>
                  <strong>Create an account</strong> at <Link href="/register" className="underline underline-offset-4">/register</Link>.
                  Passwords need at least 10 characters, one uppercase letter and one number.
                </>,
                <>
                  <strong>Verify your email.</strong> A link is sent immediately and is valid for one
                  hour. You cannot sign in until you click it. If it expires, use{" "}
                  <em>Resend verification email</em> on the confirmation screen.
                </>,
                <>
                  <strong>Create a workspace.</strong> You land on the dashboard with a prompt to
                  make your first one. Name it — the URL slug is derived automatically.
                </>,
                <>
                  <strong>Connect a social account</strong> under{" "}
                  <Term>Settings → Connections</Term>. Until you do, the composer has nothing to
                  publish to.
                </>,
              ]}
            />

            <Callout tone="note" title="Signing in with Google or GitHub">
              These buttons only appear when the deployment has credentials configured for them. If
              you don&apos;t see them, email and password is the only route in — that&apos;s
              expected, not a fault.
            </Callout>
          </DocsSection>

          {/* ------------------------------------------------------- 02 ---- */}
          <DocsSection
            id="workspaces"
            n="02"
            title="Workspaces & roles"
            lede="A workspace owns its social accounts, posts, media, campaigns and templates. Nothing is shared between workspaces — that separation is the point."
          >
            <p>
              Run one workspace per brand or client. Switch between them, or create another, from
              the switcher at the top of the sidebar. Everything you see in the app is scoped to
              whichever one is active.
            </p>

            <p>
              Invite people under <Term>Settings → Members</Term> by email, choosing a role. Pending
              invitations are listed there until accepted. Roles are strictly ranked — each one can
              do everything the roles below it can:
            </p>

            <DocsTable
              head={["Role", "Adds the ability to"]}
              rows={[
                ["Viewer", "Read posts, media, campaigns and analytics. No changes of any kind."],
                [
                  "Editor",
                  "Create posts, upload media, edit their own drafts, and send a post for review.",
                ],
                [
                  "Manager",
                  "Edit anyone's draft; approve or reject; schedule, publish, cancel and retry; connect and disconnect social accounts; manage tags, campaigns, templates and snippets; move and rename media.",
                ],
                ["Admin", "Delete media, delete an already-published post, change workspace policy."],
                ["Owner", "Everything, including deleting the workspace. The creator of a workspace."],
              ]}
            />

            <Callout tone="note" title="The Editor / Manager split">
              This is the line that shapes daily use. Editors write and send for review but cannot
              put anything live; Managers are the ones who publish. If a button is greyed out with
              &ldquo;publishing needs a Manager&rdquo;, that is this rule.
            </Callout>
          </DocsSection>

          {/* ------------------------------------------------------- 03 ---- */}
          <DocsSection
            id="connections"
            n="03"
            title="Connecting accounts"
            lede="Go to Settings → Connections, pick a workspace, and connect. Requires the Manager role or above."
          >
            <p>
              You&apos;ll be sent to the platform&apos;s own consent screen and returned with a
              banner confirming what was connected. Tokens are encrypted before they are stored, and
              refreshed automatically where the platform supports it.
            </p>

            <Callout tone="warning" title="There is no Connect Instagram button — by design">
              Meta does not offer standalone Instagram login for professional accounts. A single
              <strong> Facebook</strong> connection discovers every Instagram Business or Creator
              account linked to a Page you administer and adds them in the same step. If your
              Instagram account doesn&apos;t appear, it is either not a Business/Creator account or
              not linked to a Page you manage.
            </Callout>

            <p>
              <strong>Disconnecting is reversible.</strong> The account is marked revoked and its
              tokens are cleared, but the row is kept so publish history still points somewhere
              real. Reconnecting the same account resumes it rather than creating a duplicate.
            </p>

            <p>
              Each connection shows a status: <Term>CONNECTED</Term>, <Term>TOKEN_EXPIRED</Term>{" "}
              (reconnect to fix), <Term>REVOKED</Term> (disconnected here or access withdrawn on the
              platform), or <Term>ERROR</Term>. You can also force a token refresh from the list.
            </p>
          </DocsSection>

          {/* ------------------------------------------------------- 04 ---- */}
          <DocsSection
            id="media"
            n="04"
            title="Media library"
            lede="Everything you attach to a post lives here first. Uploads go straight from your browser to storage, so large files don't pass through the app."
          >
            <p>
              Organise with <strong>folders</strong> in the left-hand tree. Search by file name, alt
              text or caption. Star anything you reuse and filter to favourites only.
            </p>

            <p>
              Select several items to act on them together — favourite, unfavourite, or delete.
              Deleting media requires the Admin role.
            </p>

            <p>
              Images are processed after upload into sized variants, including a thumbnail used
              throughout the app and a preview used in the composer. Add <strong>alt text</strong>{" "}
              while you&apos;re here: it is carried through to the platforms that accept it, and
              it&apos;s far easier to write now than at publish time.
            </p>
          </DocsSection>

          {/* ------------------------------------------------------- 05 ---- */}
          <DocsSection
            id="composer"
            n="05"
            title="The composer"
            lede="Write once, override only what differs per platform. This is the core of the product."
          >
            <Steps
              items={[
                <>
                  <strong>Title</strong> — internal only. It never reaches a platform; it&apos;s how
                  you find the post later.
                </>,
                <>
                  <strong>Publish to</strong> — pick one or more connected accounts. Each selected
                  account gets its own tab.
                </>,
                <>
                  <strong>Shared content</strong> — the caption every account uses unless overridden.
                  Attach media, drag to reorder it, and optionally add a{" "}
                  <strong>first comment</strong> (where hashtags usually go).
                </>,
                <>
                  <strong>Per-account tabs</strong> — untick <em>Use the shared content</em> to write
                  a version just for that account. Everything else stays inherited.
                </>,
                <>
                  <strong>Preview</strong> — a schematic render per selected account, updating as you
                  type. It exists to catch truncation and missing media, not to be pixel-perfect.
                </>,
              ]}
            />

            <p>
              The <strong>character counter</strong> counts against the <em>strictest</em> platform
              you have selected, and turns amber near the limit and red past it. Select Facebook and
              Instagram together and you are held to Instagram&apos;s 2,200.
            </p>

            <p>
              Drafts <strong>autosave</strong> about a second after you stop typing, and the header
              shows <em>Saving…</em>, <em>Unsaved changes</em> or <em>Saved</em>. A new post is only
              created once you save it explicitly or take an action, so half-started ideas
              don&apos;t clutter your content list.
            </p>

            <Callout tone="note" title="Tags and campaigns need a saved draft">
              They&apos;re stored separately from the post body, so the controls stay disabled until
              the draft exists. Save first, then tag.
            </Callout>
          </DocsSection>

          {/* ------------------------------------------------------- 06 ---- */}
          <DocsSection
            id="limits"
            n="06"
            title="Platform limits"
            lede="Checked before anything is queued. A post that breaks a limit cannot be scheduled or published — the buttons stay disabled and the reasons are listed under the editor."
          >
            <DocsTable
              head={["Platform", "Caption", "Images", "Videos"]}
              rows={[
                ["Facebook", "63,206 characters", "10", "1"],
                ["Instagram", "2,200 characters", "10 (carousel)", "1"],
                ["TikTok", "2,200 characters", "—", "1"],
              ]}
            />

            <p>
              Validation runs per target account, so one platform can block a post while the others
              are fine. Fix the listed errors and the actions re-enable.
            </p>
          </DocsSection>

          {/* ------------------------------------------------------- 07 ---- */}
          <DocsSection
            id="approvals"
            n="07"
            title="Approvals"
            lede="An optional review step between writing and publishing. Editors use it as their normal route to getting something live."
          >
            <p>
              From the composer, choose <strong>Request approval</strong>. The post moves to{" "}
              <Term>PENDING_APPROVAL</Term> and appears in the reviewers&apos; queue.
            </p>

            <p>
              Reviewers (Manager and above) open <strong>Approvals</strong> in the sidebar. The queue
              is <strong>per person, not per workspace</strong> — everything waiting on you across
              every workspace you belong to, in one list.
            </p>

            <p>
              A reviewer either <strong>approves</strong>, or <strong>requests changes</strong> with
              a note explaining what to fix. Requesting changes returns the post to the author, and
              re-submitting starts a new numbered round — so the full back-and-forth stays on record
              rather than being overwritten.
            </p>
          </DocsSection>

          {/* ------------------------------------------------------- 08 ---- */}
          <DocsSection
            id="history"
            n="08"
            title="Versions & comments"
            lede="Every saved draft is a version. Nothing you write is ever silently lost."
          >
            <p>
              At the bottom of the composer, an open draft shows its version history, review state
              and comment thread. Comments are for the team — they never reach a platform.
            </p>

            <p>
              You can <strong>restore</strong> any earlier version. Restoring does not erase
              anything: it writes the old text back as a <em>new</em> version, so the history stays
              complete and the restore itself is undoable.
            </p>
          </DocsSection>

          {/* ------------------------------------------------------- 09 ---- */}
          <DocsSection
            id="scheduling"
            n="09"
            title="Scheduling & calendar"
            lede="Pick a time in the composer, then manage everything from the month view."
          >
            <p>
              <strong>Schedule</strong> in the composer opens a date and time picker. Times use your
              browser&apos;s timezone and are stored as an absolute instant, so a post scheduled for
              9am stays 9am regardless of where it&apos;s viewed from. The time must be in the
              future. Scheduling requires the Manager role.
            </p>

            <p>
              The <strong>Calendar</strong> shows a month grid starting Monday. Colours track post
              status — draft, pending approval, scheduled, publishing, published, partially
              published, failed, cancelled. <strong>Drag a post to another day</strong> to
              reschedule it. Click one to see its per-account delivery state: attempts, next retry,
              error message, and a permalink once live.
            </p>

            <Callout tone="limit" title="Repeating posts are API-only">
              Recurring schedules are fully implemented server-side and expanded automatically, but
              there is <strong>no interface</strong> for setting one yet. Today they can only be
              created through the API.
            </Callout>
          </DocsSection>

          {/* ------------------------------------------------------- 10 ---- */}
          <DocsSection
            id="publishing"
            n="10"
            title="Publishing & retries"
            lede="Publishing is a background job per account, not one blocking action — so one platform failing never takes the others down with it."
          >
            <p>
              <strong>Publish now</strong> queues every selected account immediately. You&apos;re
              told how many were queued and how many were skipped, because &ldquo;published&rdquo;
              alone would hide a platform being left out.
            </p>

            <p>
              Each account is delivered independently and <strong>retried automatically</strong> on
              failure. If some succeed and others don&apos;t, the post lands on{" "}
              <Term>PARTIALLY_PUBLISHED</Term> rather than pretending to be either. Every attempt is
              recorded with the platform&apos;s own error message, so a 6am failure is diagnosable
              at 9am. Managers can retry a failed target by hand.
            </p>

            <p>
              Once a post is published it can no longer be edited — the composer says so and locks
              the fields.
            </p>

            <Callout tone="warning" title="Local development never publishes for real">
              Facebook and Instagram publish by handing the platform a URL that <em>their</em>{" "}
              servers fetch, which localhost cannot satisfy. On a local setup every platform falls
              back to a stub that logs instead of posting. This is disabled in production, where the
              app refuses to start without a real public media address.
            </Callout>
          </DocsSection>

          {/* ------------------------------------------------------- 11 ---- */}
          <DocsSection
            id="organizing"
            n="11"
            title="Campaigns, tags & templates"
            lede="The difference between a hundred posts you can search and a hundred posts you can't."
          >
            <p>
              <strong>Campaigns</strong> group posts under one initiative — a launch, a season, a
              client push. Assign one from the composer; analytics then breaks results down by
              campaign.
            </p>

            <p>
              <strong>Tags</strong> are free-form labels for cutting across campaigns, and apply to
              both posts and media.
            </p>

            <p>
              <strong>Templates</strong> are reusable post formats. Write{" "}
              <Term>{"{{variable}}"}</Term> anywhere in the body and the placeholders are detected
              automatically — <Term>{"Introducing {{product}} — available from {{date}}."}</Term>{" "}
              exposes <em>product</em> and <em>date</em>. Using a template asks for each value and
              creates a ready-to-edit draft.
            </p>

            <p>
              <strong>Snippets</strong> are short reusable blocks — a hashtag set, a standard
              sign-off — insertable straight into the first-comment field.
            </p>

            <p>
              Under <strong>All content</strong> you can search titles and captions and filter by
              status, which is where most of this pays off.
            </p>
          </DocsSection>

          {/* ------------------------------------------------------- 12 ---- */}
          <DocsSection
            id="analytics"
            n="12"
            title="Analytics"
            lede="What you shipped and whether it arrived — measured from this platform's own publish record."
          >
            <p>Over 7, 30 or 90 days, you get:</p>

            <ul className="ml-5 list-disc space-y-1.5">
              <li>Posts published per day</li>
              <li>Delivery success rate — attempted, succeeded, failed, skipped</li>
              <li>A breakdown by platform</li>
              <li>A breakdown by campaign</li>
              <li>Recent failures, with the platform&apos;s error message</li>
            </ul>

            <Callout tone="warning" title="This is not reach, impressions or engagement">
              Those numbers live in each platform&apos;s insights API, which this product does not
              yet talk to. Rather than show empty charts or invented figures, they are left out
              entirely. If you need engagement reporting today, you&apos;ll be reading it in each
              platform&apos;s own tools.
            </Callout>
          </DocsSection>

          {/* ------------------------------------------------------- 13 ---- */}
          <DocsSection
            id="notifications"
            n="13"
            title="Notifications"
            lede="The bell in the top bar carries an unread count."
          >
            <p>
              You&apos;re notified about the things that need you: a post waiting on your review, a
              decision on something you wrote, a publish that failed. Mark items read individually
              or clear them all at once.
            </p>
          </DocsSection>

          {/* ------------------------------------------------------- 14 ---- */}
          <DocsSection
            id="security"
            n="14"
            title="Account security"
            lede="Under Settings → Security."
          >
            <p>
              <strong>Two-factor authentication.</strong> Confirm your password, scan the setup URI
              with any authenticator app (Google Authenticator, 1Password, Authy), then enter a
              six-digit code to enable it. You&apos;re shown a set of{" "}
              <strong>backup codes</strong> at that moment — each works once, and this is the only
              time they&apos;re displayed. Save them somewhere safe. After this, sign-in asks for a
              code.
            </p>

            <p>
              <strong>Active sessions.</strong> Every signed-in device is listed with its rough type,
              IP address and sign-in date. Revoke any one you don&apos;t recognise — that session is
              signed out immediately.
            </p>

            <p>
              Forgotten passwords are reset by email from the sign-in page; the link is valid for one
              hour.
            </p>
          </DocsSection>

          {/* ------------------------------------------------------- 15 ---- */}
          <DocsSection
            id="scope"
            n="15"
            title="Limits & what's missing"
            lede="Stated plainly, so you can rule the product out early rather than halfway through a migration."
          >
            <DocsTable
              head={["Area", "Where it actually stands"]}
              rows={[
                [
                  "Networks",
                  "Facebook, Instagram and TikTok publish today. LinkedIn, X, Threads, Pinterest and YouTube appear in the composer and data model but have no connection or publishing yet.",
                ],
                [
                  "Analytics",
                  "Volume and delivery reliability only. No reach, impressions or engagement.",
                ],
                [
                  "Recurring posts",
                  "Work through the API and are expanded automatically, but have no interface.",
                ],
                [
                  "AI caption assistant",
                  "A single request-and-response rewrite endpoint, behind a feature flag and requiring an API key. It has no interface in the app yet.",
                ],
                [
                  "Search",
                  "Content and media each have their own search box. There is no single cross-workspace search screen.",
                ],
              ]}
            />

            <p className="pt-2">
              Something here not matching what you see?{" "}
              <Link href="/dashboard" className="underline underline-offset-4">
                Open the dashboard
              </Link>{" "}
              and check your role first — a good share of &ldquo;missing&rdquo; buttons are
              permissions rather than gaps.
            </p>
          </DocsSection>
        </main>
      </div>
    </div>
  );
}
