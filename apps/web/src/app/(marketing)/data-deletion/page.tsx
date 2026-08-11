import type { Metadata } from "next";
import { Callout, DocsSection, DocsTable, Steps } from "@/components/marketing/docs-parts";
import { Inline, LegalShell } from "@/components/marketing/legal-shell";
import { APP_NAME, CONTACT_EMAIL, DELETION_WINDOW_DAYS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Delete your data",
  description:
    "How to have your Social Platform account and all associated data deleted, and how to revoke the service's access to your Facebook, Instagram or TikTok account.",
  alternates: { canonical: "/data-deletion" },
};

const CONTENTS = [
  { id: "request", n: "01", title: "Request deletion" },
  { id: "what", n: "02", title: "What is deleted" },
  { id: "kept", n: "03", title: "What is kept, and why" },
  { id: "revoke", n: "04", title: "Revoke platform access" },
  { id: "partial", n: "05", title: "Deleting part of your data" },
];

export default function DataDeletionPage() {
  return (
    <LegalShell
      marker="Legal"
      title="Deleting your data, and cutting off access without waiting for us."
      lede="Two separate things, and the second does not need our cooperation. You can revoke this service's access to your social accounts yourself, from the networks' own settings, right now."
      contents={CONTENTS}
    >
      <DocsSection
        id="request"
        n="01"
        title="Request deletion"
        lede={`One email. Erased within ${DELETION_WINDOW_DAYS} days, with confirmation.`}
      >
        <Callout tone="warning" title="There is no delete button in the app yet">
          {APP_NAME} does not currently offer self-serve account deletion. Requests are handled
          manually. That is stated plainly here rather than glossed over — a page describing a
          control that does not exist would be worse than no page.
        </Callout>

        <Steps
          items={[
            <>
              Email <Inline href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Inline> from the
              address on your account. Sending from that address is how the request is verified.
            </>,
            <>
              Put <strong>Data deletion request</strong> in the subject line so it is not missed.
            </>,
            <>
              Say whether you want <strong>everything</strong> deleted, or only specific data —
              disconnecting one social account, for instance. See{" "}
              <Inline href="#partial">section 05</Inline>.
            </>,
            <>
              A confirmation reply arrives once the deletion is done, within {DELETION_WINDOW_DAYS}{" "}
              days of the request and usually much sooner.
            </>,
          ]}
        />

        <p>
          If you cannot reach the account&rsquo;s email address, write from any address and explain.
          Additional verification will be needed before anything is deleted — an account cannot be
          erased on the word of someone who cannot demonstrate they own it.
        </p>
      </DocsSection>

      <DocsSection
        id="what"
        n="02"
        title="What is deleted"
        lede="Everything that identifies you, and everything you made."
      >
        <DocsTable
          head={["Category", "What goes"]}
          rows={[
            [
              "Account",
              "Name, email address, password hash, avatar, two-factor secrets and backup codes, and any linked Google or GitHub identity",
            ],
            ["Sessions", "Every active session, including the stored IP addresses and user agents"],
            [
              "Connected accounts",
              "Every connected Facebook, Instagram and TikTok account, and their access and refresh tokens — erased, not merely disabled",
            ],
            [
              "Content",
              "Posts, per-network overrides, drafts, comments, tags, campaigns, templates and snippets",
            ],
            [
              "Media",
              "Uploaded images and video, and every thumbnail and variant generated from them, removed from object storage as well as the database",
            ],
            [
              "Workspaces",
              "Any workspace you solely own, along with its contents. Where a workspace has other members, we contact you about transferring ownership before deleting it out from under them.",
            ],
            ["Notifications", "Every notification addressed to you"],
          ]}
        />
      </DocsSection>

      <DocsSection
        id="kept"
        n="03"
        title="What is kept, and why"
        lede="Three narrow exceptions, each with a reason."
      >
        <DocsTable
          head={["Kept", "Why", "For how long"]}
          rows={[
            [
              "Publish records",
              "A record that a post was published to a real social network is a record of something that happened in the world. Erasing it would make the delivery history inaccurate for the workspace's remaining members. The record is anonymised — it no longer points at you.",
              "Life of the workspace",
            ],
            [
              "Audit entries",
              "Retained for the security of workspaces you acted in, so remaining members can still see what changed. Anonymised in the same way.",
              "Life of the workspace",
            ],
            [
              "Server logs",
              "Rotated automatically by the hosting provider; not searchable by account and not retained deliberately.",
              "Short-term, rolling",
            ],
          ]}
        />

        <Callout tone="note" title="Content already published is not ours to delete">
          A post that has gone out to Facebook, Instagram or TikTok now lives on that network.
          Deleting your data here does not remove it from there — delete it on the network itself,
          or ask that network to.
        </Callout>
      </DocsSection>

      <DocsSection
        id="revoke"
        n="04"
        title="Revoke platform access"
        lede="Immediate, and entirely in your hands."
      >
        <p>
          You do not have to wait for a deletion request to be processed to stop this service
          reaching your social accounts. Revoking access from the network&rsquo;s own settings takes
          effect at once, and any token this service holds stops working immediately.
        </p>

        <p className="pt-2 font-medium">Facebook and Instagram</p>
        <Steps
          items={[
            <>
              Open{" "}
              <Inline href="https://www.facebook.com/settings?tab=applications">
                Facebook Settings → Apps and Websites
              </Inline>
              .
            </>,
            <>
              Find <strong>{APP_NAME}</strong> in the list of active apps.
            </>,
            <>
              Choose <strong>Remove</strong>. Access to the Page and to any Instagram Business
              account linked to it ends immediately.
            </>,
          ]}
        />

        <p className="pt-2 font-medium">TikTok</p>
        <Steps
          items={[
            <>
              In the TikTok app, open <strong>Profile → Menu → Settings and privacy</strong>.
            </>,
            <>
              Go to <strong>Security and permissions → Manage app permissions</strong>.
            </>,
            <>
              Find <strong>{APP_NAME}</strong> and remove it.
            </>,
          ]}
        />

        <p>
          You can also disconnect an account inside the app itself, under{" "}
          <Inline href="/settings/connections">Settings → Connections</Inline>. That erases the
          stored tokens immediately. Doing both is belt and braces, and doing either is enough to
          stop publishing.
        </p>
      </DocsSection>

      <DocsSection
        id="partial"
        n="05"
        title="Deleting part of your data"
        lede="You do not have to delete the account to remove most things."
      >
        <p>Much of this you can do yourself, right now, without emailing anyone:</p>
        <DocsTable
          head={["To remove", "Where"]}
          rows={[
            [
              "A connected social account",
              <>
                <Inline href="/settings/connections">Settings → Connections</Inline> → Disconnect.
                Tokens are erased at once.
              </>,
            ],
            [
              "A post",
              <>
                <Inline href="/content">All content</Inline> → delete. Publish records for anything
                already sent are retained, as above.
              </>,
            ],
            [
              "A media file",
              <>
                <Inline href="/media">Media</Inline> → select → delete. Variants go with it.
              </>,
            ],
            [
              "A whole workspace",
              <>
                <Inline href="/settings">Settings</Inline> → delete workspace. Owner only, and it
                takes its contents with it.
              </>,
            ],
            [
              "An active session",
              <>
                <Inline href="/settings/security">Settings → Security</Inline> → revoke. Useful if
                you signed in somewhere you no longer trust.
              </>,
            ],
          ]}
        />
        <p>
          For anything else, or for the account itself, email{" "}
          <Inline href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Inline>.
        </p>
        <p>
          The <Inline href="/privacy">Privacy Policy</Inline> sets out what is collected in the
          first place and how long it is kept.
        </p>
      </DocsSection>
    </LegalShell>
  );
}
