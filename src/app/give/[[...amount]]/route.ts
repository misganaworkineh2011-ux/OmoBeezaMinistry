import { getGiving } from "@/lib/data/giving";
import { yebunaLink } from "@/lib/giving";

// Payment links on the ministry's own address, for reminders and shared links:
//   /give/250 → the Ye-Buna payment page for 250 birr (Giving & reminders →
//               Ye-Buna link for each amount), or the general Ye-Buna page
//               when that amount has no link of its own
//   /give     → the general Ye-Buna page
// Without any Ye-Buna link it opens the website's Donations page. The
// redirect is temporary (302), so changing a link in the dashboard takes
// effect at once, even for messages already sent.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ amount?: string[] }> }): Promise<Response> {
  const parts = (await params).amount ?? [];
  const amount = parts.length === 1 && /^\d{1,7}$/.test(parts[0]) ? Number(parts[0]) : undefined;
  const target = parts.length > 1 || (parts.length === 1 && amount === undefined) ? "" : yebunaLink(await getGiving(), amount);
  const location = target.startsWith("https://") ? target : new URL("/donations", request.url).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
