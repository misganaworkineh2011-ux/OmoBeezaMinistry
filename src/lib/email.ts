import "server-only";
import { query } from "@/lib/db";

// Email through any SMTP server. Configure in Vercel:
//   SMTP_HOST   e.g. smtp.gmail.com            — required
//   SMTP_PORT   465 (SSL) or 587 (STARTTLS)    — optional, default 465
//   SMTP_USER   the mailbox to sign in as       — required
//   SMTP_PASS   its password (for Gmail: an app password) — required
//   EMAIL_FROM  e.g. "Omo Beeza Ministry <omobeeza@gmail.com>" — optional, defaults to SMTP_USER
// Every attempt is written to sms_log (channel 'email') so the dashboard shows it.

export type EmailKind = "reminder" | "welcome" | "test" | "manual";

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function emailConfig(): { host: string; user: string; from: string; ready: boolean } {
  return {
    host: process.env.SMTP_HOST ?? "",
    user: process.env.SMTP_USER ?? "",
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || "",
    ready: emailConfigured(),
  };
}

type Transport = import("nodemailer").Transporter;
let transport: Transport | null = null;

async function transporter(): Promise<Transport> {
  if (transport) return transport;
  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT) || 465;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    pool: true,
    maxConnections: 2,
  });
  return transport;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain text → simple HTML: paragraphs, line breaks and clickable links. */
function toHtml(text: string, button?: { text: string; url: string }): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => escapeHtml(p).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#1e4a7c">${url}</a>`).replace(/\n/g, "<br>"))
    .map((p) => `<p style="margin:0 0 16px">${p}</p>`)
    .join("");
  const cta = button
    ? `<p style="margin:8px 0 24px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#d99a2b;color:#0b1f36;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:12px">${escapeHtml(button.text)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f7f3ec;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#132132;font-size:16px;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
<div style="background:#0b1f36;color:#f0c977;padding:18px 24px;font-size:18px;font-weight:bold">Omo Beeza Ministry</div>
<div style="padding:24px">${paragraphs}${cta}</div>
</div></body></html>`;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  kind: EmailKind;
  donorId?: number | null;
  button?: { text: string; url: string };
}): Promise<{ ok: boolean; error?: string }> {
  const log = (status: "sent" | "failed", providerId: string, error: string) =>
    query(
      "insert into sms_log (donor_id, to_phone, message, kind, status, provider_id, error, channel) values ($1, $2, $3, $4, $5, $6, $7, 'email')",
      [opts.donorId ?? null, opts.to, `${opts.subject}\n\n${opts.text}`, opts.kind, status, providerId.slice(0, 200), error.slice(0, 500)],
    ).catch((err) => console.error("email: could not log", err));

  if (!emailConfigured()) {
    await log("failed", "", "Email is not set up (SMTP_HOST, SMTP_USER, SMTP_PASS)");
    return { ok: false, error: "Email is not set up yet (SMTP_HOST, SMTP_USER and SMTP_PASS in Vercel)." };
  }
  try {
    const info = await (await transporter()).sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: opts.to,
      subject: opts.subject,
      text: opts.button && !opts.text.includes(opts.button.url) ? `${opts.text}\n\n${opts.button.text}: ${opts.button.url}` : opts.text,
      html: toHtml(opts.text, opts.button),
    });
    await log("sent", info.messageId ?? "", "");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    await log("failed", "", message);
    return { ok: false, error: `Email: ${message}` };
  }
}

/** Close pooled connections (after a batch, so the server function can finish). */
export function closeEmail(): void {
  transport?.close();
  transport = null;
}
