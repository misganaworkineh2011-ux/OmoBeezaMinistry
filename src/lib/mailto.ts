// Form delivery. Submissions are saved to the dashboard inbox via /api/forms.
// If that isn't available (no database configured, or the request fails),
// the visitor's email app opens with a pre-filled message instead, so no
// message is ever lost.

export interface MailField {
  label: string;
  value: string;
}

export type FormType = "contact" | "careers" | "prayer" | "newsletter" | "donation";

/** "saved" = stored in the dashboard inbox; "mailto" = handed to the email app. */
export type DeliveryMode = "saved" | "mailto";

export function buildMailto(to: string, subject: string, fields: MailField[]): string {
  const body = fields
    .filter((f) => f.value.trim() !== "")
    .map((f) => `${f.label}:\n${f.value.trim()}`)
    .join("\n\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openMailto(href: string): void {
  window.location.href = href;
}

export async function deliver(
  type: FormType,
  subject: string,
  fields: MailField[],
  opts: { to: string; name?: string; email?: string },
): Promise<DeliveryMode> {
  try {
    const res = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        name: opts.name ?? "",
        email: opts.email ?? "",
        subject,
        fields: fields.filter((f) => f.value.trim() !== ""),
        page: window.location.pathname,
      }),
    });
    if (res.ok) return "saved";
  } catch {
    // fall through to email
  }
  const sender: MailField[] = [
    { label: "Name", value: opts.name ?? "" },
    { label: "Email", value: opts.email ?? "" },
  ];
  openMailto(buildMailto(opts.to, subject, [...sender, ...fields]));
  return "mailto";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
