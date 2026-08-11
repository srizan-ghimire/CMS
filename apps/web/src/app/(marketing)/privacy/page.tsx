import type { Metadata } from "next";
import { Callout, DocsSection, DocsTable, Term } from "@/components/marketing/docs-parts";
import { Inline, LegalShell } from "@/components/marketing/legal-shell";
import {
  APP_NAME,
  CONTACT_EMAIL,
  DELETION_WINDOW_DAYS,
  JURISDICTION,
  OPERATOR_NAME,
  SUB_PROCESSORS,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Social Platform collects, why, who it is shared with, how long it is kept, and how to have it deleted.",
  alternates: { canonical: "/privacy" },
};

const CONTENTS = [
  { id: "who", n: "01", title: "Who operates this" },
  { id: "collect", n: "02", title: "What is collected" },
  { id: "platform-data", n: "03", title: "Data from social networks" },
  { id: "use", n: "04", title: "How it is used" },
  { id: "sharing", n: "05", title: "Who it is shared with" },
  { id: "retention", n: "06", title: "How long it is kept" },
  { id: "deletion", n: "07", title: "Deleting your data" },
  { id: "security", n: "08", title: "Security" },
  { id: "cookies", n: "09", title: "Cookies" },
  { id: "transfers", n: "10", title: "Where data is stored" },
  { id: "rights", n: "11", title: "Your rights" },
  { id: "children", n: "12", title: "Children" },
  { id: "changes", n: "13", title: "Changes" },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      marker="Legal"
      title="What this service knows about you, and why."
      lede="Written against the system as it actually behaves, including the parts most policies leave vague — which third parties see your content, what a connected social account really grants, and what happens when you ask for it all to go."
      contents={CONTENTS}
    >
      <DocsSection
        id="who"
        n="01"
        title="Who operates this"
        lede={`${APP_NAME} is operated by an individual, not a company.`}
      >
        <p>
          {APP_NAME} (&ldquo;the service&rdquo;) is run by {OPERATOR_NAME}, based in {JURISDICTION},
          acting as the controller of the personal data described here. It is a personal project
          rather than a commercial product, which is relevant in one practical way: there is no
          support team behind it, and requests are answered by one person.
        </p>
        <p>
          For anything in this policy, including requests to access or delete your data, write to{" "}
          <Inline href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Inline>.
        </p>
      </DocsSection>

      <DocsSection
        id="collect"
        n="02"
        title="What is collected"
        lede="Four categories, all of them a direct consequence of a feature you used."
      >
        <DocsTable
          head={["Category", "Fields", "Why it exists"]}
          rows={[
            [
              "Account",
              "Name, email address, whether the email is verified, optional avatar URL, password (hashed), and — if you enable it — two-factor secrets and backup codes",
              "To create your account, sign you in, and let colleagues recognise you",
            ],
            [
              "Session",
              "IP address, browser user-agent, and session expiry",
              "To keep you signed in and to let you review and revoke active sessions under Settings → Security",
            ],
            [
              "Connected accounts",
              "The display name, handle, avatar and account identifier of each social account you connect, plus access and refresh tokens",
              "To show you which accounts are connected and to publish on their behalf",
            ],
            [
              "Content you create",
              "Posts and per-network overrides, uploaded media and its generated thumbnails, comments, tags, campaigns, templates and snippets",
              "This is the product — it is the material you are composing and scheduling",
            ],
          ]}
        />

        <p>
          The service also writes an <Term>audit log</Term> recording who did what and when — the
          acting user, the action, the record affected, and the originating IP address. It is how a
          workspace owner can see who deleted a post or changed someone&rsquo;s role.
        </p>

        <Callout tone="limit" title="Not collected">
          No advertising identifiers, no behavioural tracking, no third-party analytics, no
          fingerprinting, and no data purchased from anyone. The service carries no analytics script
          of any kind.
        </Callout>
      </DocsSection>

      <DocsSection
        id="platform-data"
        n="03"
        title="Data from social networks"
        lede="Connecting an account grants specific, listed permissions. Here is each one and what it is for."
      >
        <p>
          When you connect a Facebook, Instagram or TikTok account, that network gives the service
          an access token scoped to the permissions below. You grant them on the network&rsquo;s own
          consent screen, and you can withdraw them at any time from that network&rsquo;s settings.
        </p>

        <p className="pt-2 font-medium">Facebook and Instagram</p>
        <DocsTable
          head={["Permission", "What it allows"]}
          rows={[
            ["pages_show_list", "List the Pages you manage, so you can pick which to connect"],
            ["pages_read_engagement", "Read a Page's basic profile — its name and picture"],
            ["pages_manage_posts", "Publish the posts you compose to a connected Page"],
            [
              "pages_manage_metadata",
              "Read publishing status back, so delivery can be reported honestly",
            ],
            ["instagram_basic", "Identify the Instagram Business account linked to a Page"],
            [
              "instagram_content_publish",
              "Publish the posts you compose to that Instagram account",
            ],
            ["business_management", "Resolve which Pages belong to your Business portfolio"],
          ]}
        />

        <Callout tone="note" title="Instagram has no separate connection">
          A single Facebook grant returns both the Page and any Instagram Business account linked to
          it. There is no separate Instagram login, and no Instagram permission is requested beyond
          the two listed.
        </Callout>

        <p className="pt-2 font-medium">TikTok</p>
        <DocsTable
          head={["Permission", "What it allows"]}
          rows={[
            ["user.info.basic", "Identify the connected account"],
            ["user.info.profile", "Show its display name and avatar in the connections list"],
            ["video.publish", "Publish the videos you compose to that account"],
          ]}
        />

        <Callout tone="warning" title="What is never done with platform data">
          Data obtained from Meta or TikTok is <strong>not sold</strong>, not shared with data
          brokers, not used for advertising or ad targeting, not used to build profiles of you or
          anyone else, and not used to train machine-learning models. It is used only to operate the
          features you asked for, and it is deleted when you disconnect the account or delete your
          data.
        </Callout>

        <p>
          The service does <strong>not</strong> read your followers, your audience demographics,
          your direct messages, or the comments on your posts. It does not retrieve reach,
          impressions or engagement figures — the analytics screen reports only this service&rsquo;s
          own record of what it attempted to deliver and whether that succeeded.
        </p>
      </DocsSection>

      <DocsSection
        id="use"
        n="04"
        title="How it is used"
        lede="Every use below maps to a feature. There is no secondary use."
      >
        <ul className="marker:text-muted-foreground list-disc space-y-2 pl-5">
          <li>
            Creating and securing your account, including email verification and optional 2FA.
          </li>
          <li>Showing you your workspaces, content and connected accounts.</li>
          <li>
            Publishing the posts you schedule, to the accounts you selected, at the time you chose.
          </li>
          <li>
            Sending transactional email — verification, password reset, workspace invitations.
          </li>
          <li>Reporting delivery outcomes, including failures and retry attempts.</li>
          <li>Keeping the audit log that lets workspace owners see who changed what.</li>
          <li>Diagnosing faults from server logs when something breaks.</li>
        </ul>
        <p>
          No marketing email is sent. Your content is not read except as needed to publish it, and
          is never used to train a model.
        </p>
      </DocsSection>

      <DocsSection
        id="sharing"
        n="05"
        title="Who it is shared with"
        lede="A short list of infrastructure providers, and the social networks you explicitly connect."
      >
        <DocsTable
          head={["Provider", "Purpose", "What it receives"]}
          rows={SUB_PROCESSORS.map((p) => [p.name, p.purpose, p.data])}
        />

        <Callout tone="note" title="The AI caption assistant is opt-in and conditional">
          The service only contacts Anthropic if the caption assistant is enabled and you use it,
          and it sends only the text you asked it to rewrite. If the feature is switched off — the
          default — no content leaves the service for this purpose at all.
        </Callout>

        <p>
          Beyond these, data is disclosed only where the law requires it, or to establish or defend
          a legal claim. Your data is never sold, rented or traded.
        </p>
      </DocsSection>

      <DocsSection
        id="retention"
        n="06"
        title="How long it is kept"
        lede="Until you remove it, with three exceptions worth naming."
      >
        <DocsTable
          head={["Data", "Retention"]}
          rows={[
            ["Account and content", "Until you ask for deletion"],
            ["Sessions", "Until they expire or you revoke them; 30 days at most"],
            [
              "Social account tokens",
              "Until you disconnect the account, at which point they are erased immediately",
            ],
            [
              "Publish records",
              "Kept after a post is deleted — a record that something was published to a real network is history, and erasing it would misreport what happened",
            ],
            ["Audit log", "Kept for the life of the workspace"],
            ["Server logs", "Retained by the hosting provider on a rolling short-term basis"],
          ]}
        />
      </DocsSection>

      <DocsSection
        id="deletion"
        n="07"
        title="Deleting your data"
        lede="By email, handled by hand, within 30 days."
      >
        <p>
          The service has no self-serve &ldquo;delete my account&rdquo; button yet. That is stated
          plainly rather than implied, because a policy promising a control that does not exist
          would be misleading. Requests are handled manually.
        </p>
        <p>
          Email <Inline href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Inline> from the address
          on the account. Your data is erased within {DELETION_WINDOW_DAYS} days and you receive
          confirmation. Full instructions, including what survives deletion and why, are on the{" "}
          <Inline href="/data-deletion">data deletion page</Inline>.
        </p>
        <p>
          You do not need this service&rsquo;s cooperation to cut off its access to your social
          accounts — you can revoke it from Facebook or TikTok directly, and the deletion page
          explains how.
        </p>
      </DocsSection>

      <DocsSection
        id="security"
        n="08"
        title="Security"
        lede="What is actually implemented, not what is aspired to."
      >
        <ul className="marker:text-muted-foreground list-disc space-y-2 pl-5">
          <li>
            Social account tokens are encrypted with <Term>AES-256-GCM</Term> before they reach the
            database. They are decrypted only for the duration of a call to that network and are
            never written to logs.
          </li>
          <li>Passwords are hashed; they are never stored in a readable form.</li>
          <li>All traffic runs over HTTPS.</li>
          <li>Every API route requires an authenticated session by default.</li>
          <li>Access inside a workspace is limited by role, checked on every request.</li>
          <li>Optional two-factor authentication using a TOTP app, with backup codes.</li>
        </ul>
        <Callout tone="warning" title="No system is perfectly secure">
          This is a personal project running on shared infrastructure. It applies the measures above
          honestly, but it cannot offer the assurances of an audited commercial service. Please
          weigh that before connecting a business-critical account.
        </Callout>
      </DocsSection>

      <DocsSection id="cookies" n="09" title="Cookies" lede="One cookie. It keeps you signed in.">
        <p>
          The service sets a single session cookie once you sign in. It is required for the
          application to work — without it every page would treat you as a stranger — so no consent
          banner is shown for it.
        </p>
        <p>
          There are no analytics cookies, no advertising cookies, and no third-party trackers.
          Clearing the cookie signs you out and nothing else.
        </p>
      </DocsSection>

      <DocsSection
        id="transfers"
        n="10"
        title="Where data is stored"
        lede="Singapore, with providers that may process elsewhere."
      >
        <p>
          The application and database run in Singapore. Email delivery, DNS and the social networks
          themselves are operated by providers who may process data in the United States, the
          European Union and elsewhere.
        </p>
        <p>
          If you are in a region with data-transfer rules — the EEA or the UK, for instance — using
          the service means your data will be processed outside that region. If you would rather it
          were not, please do not create an account.
        </p>
      </DocsSection>

      <DocsSection
        id="rights"
        n="11"
        title="Your rights"
        lede="Access, correction, export, deletion, objection. One email, one person answering."
      >
        <p>
          Depending on where you live you may have rights to access the data held about you, correct
          it, receive a copy in a portable form, have it deleted, restrict how it is used, or object
          to that use. Where processing rests on your consent — connecting a social account, using
          the caption assistant — you can withdraw that consent at any time.
        </p>
        <p>
          Exercise any of these by writing to{" "}
          <Inline href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Inline>. There is no charge, and
          a reply comes within {DELETION_WINDOW_DAYS} days. If you believe your data has been
          mishandled you may also complain to your local data-protection authority.
        </p>
      </DocsSection>

      <DocsSection id="children" n="12" title="Children" lede="Not for under-16s.">
        <p>
          The service is not intended for anyone under 16, and accounts are not knowingly created
          for them. Meta and TikTok impose their own minimum ages on the accounts you connect. If
          you believe a child has created an account, write to{" "}
          <Inline href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Inline> and it will be removed.
        </p>
      </DocsSection>

      <DocsSection
        id="changes"
        n="13"
        title="Changes"
        lede="The date at the top is a claim that this text matches the system."
      >
        <p>
          This policy is updated when the service&rsquo;s handling of data changes, and the
          effective date at the top moves with it. Material changes are announced by email to the
          address on your account before they take effect. Continuing to use the service afterwards
          means you accept the revised policy.
        </p>
        <p>
          See also the <Inline href="/terms">Terms of Service</Inline>, which govern your use of the
          service itself.
        </p>
      </DocsSection>
    </LegalShell>
  );
}
