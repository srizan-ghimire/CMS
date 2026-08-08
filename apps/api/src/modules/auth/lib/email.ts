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

export async function sendMail({ to, subject, html }: SendMailInput): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "no-reply@socialplatform.dev",
    to,
    subject,
    html,
  });
}
