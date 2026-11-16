import { hasDb, query } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";

// The List-Unsubscribe link in every reminder email (RFC 8058). Gmail and other
// mail apps show an "Unsubscribe" button next to the sender; pressing it POSTs
// here and stops that donor's reminders. Mail providers expect this from
// senders of regular email, and it keeps reminders out of the spam folder.
// Opening the link in a browser (GET) only shows the stop page, where the
// donor confirms with a button.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const valid = (token: string) => /^[A-Za-z0-9_-]{8,40}$/.test(token);

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  if (valid(token) && hasDb()) {
    await query("update donors set status = 'stopped', stopped_at = now() where token = $1 and status <> 'stopped'", [token]);
  }
  return new Response("Unsubscribed", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  return Response.redirect(valid(token) ? `${publicOrigin()}/stop/${token}` : publicOrigin(), 302);
}
