import nodemailer from "nodemailer";

// Read straight from process.env rather than ConfigService: this module is pulled in by auth.ts,
// which must be constructible at import time for AuthModule.forRoot(). Every variable below is
// still validated — configuration.ts declares them all, and requires a non-loopback SMTP_HOST in
// production, because requireEmailVerification means a broken transport blocks every signup.
const port = Number(process.env.SMTP_PORT ?? 1025);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port,
  // Implicit TLS is port 465 only; 587 negotiates STARTTLS after connecting, so `secure` must be
  // false there or the handshake hangs. Mailhog (dev, 1025) is plaintext.
  secure: process.env.SMTP_SECURE === "true" || port === 465,
  // Mailhog accepts unauthenticated connections; a real provider needs SMTP_USER / SMTP_PASS.
  ...(process.env.SMTP_USER
    ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
    : {}),
});

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend over HTTPS.
 *
 * Preferred in any hosted environment because PaaS providers routinely block outbound SMTP —
 * Render blocks 25, 465 and 587 — and the failure mode is the worst kind: the TCP connect times
 * out after ~2 minutes with `ETIMEDOUT` on `CONN`, inside a Better Auth background task, so signup
 * appears to succeed and no verification email ever arrives. Port 443 is never blocked, and a
 * rejected send comes back immediately with a reason.
 */
async function sendViaResend({ to, subject, html }: SendMailInput): Promise<void> {
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.SMTP_FROM ?? "no-reply@socialplatform.dev",
      to,
      subject,
      html,
    }),
    // Bounded so a hung request cannot pin a Better Auth background task open indefinitely.
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    // Resend's body names the cause — an unverified sending domain, or a `from` on a domain other
    // than the verified one — and neither is guessable from the status code alone.
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend rejected the message (${response.status}): ${detail.slice(0, 300)}`);
  }
}

/**
 * Transport selection is by configuration, not by environment name: set RESEND_API_KEY and mail
 * goes over HTTPS, leave it unset and it goes over SMTP. Local development needs the SMTP path —
 * Mailhog only speaks SMTP — so this cannot simply become "HTTP in production".
 */
export async function sendMail({ to, subject, html }: SendMailInput): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    await sendViaResend({ to, subject, html });
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "no-reply@socialplatform.dev",
    to,
    subject,
    html,
  });
}
