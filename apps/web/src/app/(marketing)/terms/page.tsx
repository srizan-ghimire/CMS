import type { Metadata } from "next";
import { Callout, DocsSection, DocsTable } from "@/components/marketing/docs-parts";
import { Inline, LegalShell } from "@/components/marketing/legal-shell";
import { APP_NAME, JURISDICTION, OPERATOR_NAME, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing use of Social Platform: what it does, what it does not do, what is expected of you, and what is not guaranteed.",
  alternates: { canonical: "/terms" },
};

const CONTENTS = [
  { id: "acceptance", n: "01", title: "Accepting these terms" },
  { id: "service", n: "02", title: "What the service does" },
  { id: "not", n: "03", title: "What it does not do" },
  { id: "account", n: "04", title: "Your account" },
  { id: "acceptable-use", n: "05", title: "Acceptable use" },
  { id: "networks", n: "06", title: "Connected social networks" },
  { id: "content", n: "07", title: "Your content" },
  { id: "availability", n: "08", title: "Availability" },
  { id: "termination", n: "09", title: "Ending the arrangement" },
  { id: "disclaimer", n: "10", title: "Disclaimer" },
  { id: "liability", n: "11", title: "Liability" },
  { id: "law", n: "12", title: "Governing law" },
  { id: "changes", n: "13", title: "Changes" },
];

export default function TermsPage() {
  return (
    <LegalShell
      marker="Legal"
      title="The terms, including the ones most services bury."
      lede="A personal project offered free and as-is. That shapes everything below — what is promised, what is not, and why the availability section says what it says rather than something more reassuring."
      contents={CONTENTS}
    >
      <DocsSection
        id="acceptance"
        n="01"
        title="Accepting these terms"
        lede="Creating an account accepts them. If you do not, do not create one."
      >
        <p>
          These terms are an agreement between you and {OPERATOR_NAME}, who operates {APP_NAME}
          (&ldquo;the service&rdquo;). By creating an account or using the service you accept them.
        </p>
        <p>
          You must be at least 16 years old and able to enter into a binding agreement. If you use
          the service on behalf of an organisation, you confirm you are authorised to accept these
          terms for it.
        </p>
      </DocsSection>

      <DocsSection
        id="service"
        n="02"
        title="What the service does"
        lede="Compose once, override per network, route through approval, schedule, publish, and record what happened."
      >
        <p>
          {APP_NAME} is a social content management tool. You write a post once, adjust it per
          network, optionally send it through an approval step, schedule it, and the service
          publishes it to the accounts you connected — retrying failures and keeping a record of
          every attempt.
        </p>
        <p>
          Workspaces separate one body of work from another, and roles control who may do what
          inside them. The <Inline href="/docs">documentation</Inline> describes the whole feature
          set in detail.
        </p>
      </DocsSection>

      <DocsSection
        id="not"
        n="03"
        title="What it does not do"
        lede="Stated up front, because two features are narrower than their names suggest."
      >
        <DocsTable
          head={["Feature", "What it actually is"]}
          rows={[
            [
              "Analytics",
              "Content volume and delivery reliability, drawn from this service's own publish record. It does not report reach, impressions or engagement — those require each network's insights API, which this service does not use.",
            ],
            [
              "AI assistant",
              "A single request-and-response caption helper, available only where it has been enabled. It is not a strategist, a scheduler or an autonomous agent.",
            ],
            [
              "Inbox and community management",
              "Not offered. The service does not read or reply to comments or direct messages.",
            ],
            [
              "Audience data",
              "Not collected. No follower counts, demographics or audience insights are retrieved.",
            ],
          ]}
        />
        <p>
          Networks other than Facebook, Instagram and TikTok appear in the interface but have no
          publishing integration behind them yet.
        </p>
      </DocsSection>

      <DocsSection
        id="account"
        n="04"
        title="Your account"
        lede="Accurate details, a password you keep to yourself, and responsibility for what happens under it."
      >
        <ul className="marker:text-muted-foreground list-disc space-y-2 pl-5">
          <li>Register with accurate details and a working email address.</li>
          <li>
            Keep your password confidential. Two-factor authentication is available and worth
            enabling.
          </li>
          <li>You are responsible for everything done through your account.</li>
          <li>
            Tell us at <Inline href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Inline> if you
            think it has been compromised.
          </li>
          <li>
            If you invite others into a workspace, you are responsible for who you invite and the
            role you give them.
          </li>
        </ul>
      </DocsSection>

      <DocsSection
        id="acceptable-use"
        n="05"
        title="Acceptable use"
        lede="Do not use this service to publish what the networks themselves would remove."
      >
        <p>You agree not to use the service to:</p>
        <ul className="marker:text-muted-foreground list-disc space-y-2 pl-5">
          <li>Publish unlawful, defamatory, harassing, hateful or deceptive content.</li>
          <li>Infringe anyone&rsquo;s copyright, trade mark or other rights.</li>
          <li>Send spam, or post at a volume or repetition intended to manipulate a platform.</li>
          <li>Impersonate a person or organisation, or misrepresent your affiliation with one.</li>
          <li>Publish to accounts you are not authorised to act for.</li>
          <li>
            Attempt to breach the service&rsquo;s security, probe it for vulnerabilities without
            permission, or disrupt it for others.
          </li>
          <li>Reverse-engineer it, resell access to it, or use it to build a competing product.</li>
          <li>Upload malware, or content designed to damage a system that processes it.</li>
        </ul>
        <p>
          Accounts that breach this section may be suspended or removed, without notice where the
          breach is serious.
        </p>
      </DocsSection>

      <DocsSection
        id="networks"
        n="06"
        title="Connected social networks"
        lede="Their rules apply to you as much as these do, and their access can disappear without warning."
      >
        <p>
          The service is not affiliated with, endorsed by, or sponsored by Meta Platforms, Inc. or
          ByteDance Ltd. Facebook, Instagram and TikTok are trademarks of their respective owners.
        </p>
        <p>
          Connecting an account means you also agree to that network&rsquo;s own terms and policies,
          and that you have the right to publish to the account you connect. Content published
          through the service is subject to that network&rsquo;s rules and moderation — it can be
          removed by them, and this service has no ability to prevent or reverse that.
        </p>
        <Callout tone="warning" title="Platform access is outside this service's control">
          A network can change its API, revoke a permission, expire a token, rate-limit an
          application or suspend it entirely, at any time and without notice. Any of those can stop
          publishing from working. This is a normal characteristic of building on someone
          else&rsquo;s platform, not a defect, and no compensation is offered when it happens.
        </Callout>
      </DocsSection>

      <DocsSection
        id="content"
        n="07"
        title="Your content"
        lede="It stays yours. The licence granted is only what is needed to run the service."
      >
        <p>
          You keep all rights to the posts, media and other material you create or upload. No
          ownership is claimed.
        </p>
        <p>
          By uploading content you grant a limited, non-exclusive, royalty-free licence to store,
          process, reproduce and transmit it strictly to operate the service for you — to display it
          in the composer, generate thumbnails, and deliver it to the networks you selected. The
          licence exists for no other purpose and ends when you delete the content, except for
          copies already published to a network, which are governed by that network.
        </p>
        <p>
          You confirm you hold the rights to everything you upload and publish, including any
          third-party material within it.
        </p>
      </DocsSection>

      <DocsSection
        id="availability"
        n="08"
        title="Availability"
        lede="There is no uptime guarantee, and the reasons are specific rather than boilerplate."
      >
        <p>
          The service runs on free infrastructure tiers. In practice that means the application
          sleeps when idle and the first request after a quiet period can take up to a minute, the
          database provider pauses a project left unused for a week, and background jobs do not run
          while the application is asleep.
        </p>
        <Callout tone="warning" title="Scheduled posts may not publish on time">
          A post scheduled for a moment when the service is asleep will not go out at that moment.
          It fires when the service next wakes, or not at all.{" "}
          <strong>Do not rely on this service for time-critical publishing.</strong>
        </Callout>
        <p>
          The service may be modified, interrupted or discontinued at any time without notice. Take
          your own copies of anything you cannot afford to lose.
        </p>
      </DocsSection>

      <DocsSection
        id="termination"
        n="09"
        title="Ending the arrangement"
        lede="You can leave whenever. So can the service."
      >
        <p>
          Stop using the service at any time, and request deletion of your data through the{" "}
          <Inline href="/data-deletion">data deletion page</Inline>.
        </p>
        <p>
          Access may be suspended or ended if you breach these terms, if required by law, or if the
          service is discontinued. Where it is discontinued deliberately, reasonable notice will be
          given by email so you can export what you need.
        </p>
      </DocsSection>

      <DocsSection
        id="disclaimer"
        n="10"
        title="Disclaimer"
        lede="Provided as-is, with no warranties."
      >
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
          warranty of any kind, express or implied, including any implied warranty of
          merchantability, fitness for a particular purpose or non-infringement.
        </p>
        <p>
          No warranty is given that the service will be uninterrupted, timely, secure or error-free;
          that posts will publish successfully or on schedule; that data will not be lost; or that
          defects will be corrected.
        </p>
      </DocsSection>

      <DocsSection
        id="liability"
        n="11"
        title="Liability"
        lede="Free service, correspondingly limited exposure."
      >
        <p>
          To the fullest extent the law allows, {OPERATOR_NAME} is not liable for any indirect,
          incidental, special, consequential or exemplary damages, nor for lost profits, lost
          revenue, lost data, lost goodwill, or losses arising from a post that failed to publish,
          published late, or published in a form you did not intend.
        </p>
        <p>
          Total liability for any claim relating to the service is limited to the greater of the
          amount you paid for it in the preceding twelve months — which, the service being free, is
          nil — or USD 50.
        </p>
        <p>
          Nothing here excludes liability that cannot lawfully be excluded, including for death or
          personal injury caused by negligence, or for fraud.
        </p>
      </DocsSection>

      <DocsSection id="law" n="12" title="Governing law" lede={`The laws of ${JURISDICTION}.`}>
        <p>
          These terms are governed by the laws of {JURISDICTION}, and the courts of {JURISDICTION}{" "}
          have exclusive jurisdiction over any dispute arising from them or from the service. This
          does not remove any protection available to you under the mandatory law of the country you
          live in.
        </p>
        <p>
          If any provision is found unenforceable, the rest remains in force. A failure to enforce a
          provision is not a waiver of it.
        </p>
      </DocsSection>

      <DocsSection id="changes" n="13" title="Changes" lede="Announced by email when they matter.">
        <p>
          These terms may be updated, and the effective date at the top moves when they are.
          Material changes are announced by email to the address on your account before they take
          effect. Continuing to use the service afterwards accepts the revised terms; if you do not
          accept them, stop using the service and request deletion of your data.
        </p>
        <p>
          See also the <Inline href="/privacy">Privacy Policy</Inline>, which explains what data the
          service holds and why.
        </p>
      </DocsSection>
    </LegalShell>
  );
}
