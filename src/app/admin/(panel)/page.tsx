import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadMode } from "@/lib/uploads";
import { dailySeries, total } from "@/lib/admin/stats";
import Icon from "@/components/Icon";
import BarChart from "@/components/admin/BarChart";
import ImportButton from "@/components/admin/ImportButton";
import MediaMover from "@/components/admin/MediaMover";
import { mediaStatus } from "@/app/admin/actions/media";

export const metadata = { title: "Overview" };
// The media move (a server action on this page) runs in ~35 s batches.
export const maxDuration = 60;

const TYPE_LABEL: Record<string, string> = {
  contact: "Contact",
  careers: "Careers",
  prayer: "Prayer",
  newsletter: "Newsletter",
  donation: "Donation pledge",
};

export default async function Overview() {
  const user = await requireUser();

  const [unread, views7, donate7, prayers7, prayersAll, chats7, posts, series, recent] = await Promise.all([
    total("select count(*)::int as n from submissions where status = 'new'"),
    total("select coalesce(sum(count),0)::int as n from analytics where event = 'view' and day > current_date - 7"),
    total("select coalesce(sum(count),0)::int as n from analytics where event = 'donate_click' and day > current_date - 7"),
    total("select count(*)::int as n from prayer_log where created_at > now() - interval '7 days'"),
    total("select coalesce(sum(prayers),0)::int as n from children"),
    total("select count(*)::int as n from chat_logs where created_at > now() - interval '7 days'"),
    total("select count(*)::int as n from posts"),
    dailySeries("view", 14),
    query<{ id: number; type: string; name: string; email: string; status: string; created_at: string }>(
      "select id, type, name, email, status, created_at from submissions where status <> 'archived' order by created_at desc limit 6",
    ),
  ]);

  const needsImport = !(await queryOne("select 1 from settings where key = 'knowledge_managed'")) || posts === 0;
  const mode = uploadMode();
  const toMove = !needsImport && (mode === "blob" || mode === "presigned") ? await mediaStatus() : 0;

  const cards = [
    { href: "/admin/inbox", icon: "mail", value: unread, label: "Unread messages" },
    { href: "/admin/analytics", icon: "eye", value: views7, label: "Page views · 7 days" },
    { href: "/admin/analytics", icon: "heart", value: donate7, label: "Donate clicks · 7 days" },
    { href: "/admin/children", icon: "handHeart", value: prayers7, label: `Prayers · 7 days (${prayersAll} total)` },
    { href: "/admin/chatbot", icon: "sparkles", value: chats7, label: "Chatbot questions · 7 days" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome, {user.name.split(" ")[0]}</h1>
          <p>Here&apos;s what&apos;s happening on the Omo Beeza website.</p>
        </div>
      </div>

      {needsImport ? (
        <section className="panel" style={{ marginBottom: 18 }}>
          <div className="panel__head">
            <div>
              <h2>Finish setting up</h2>
              <p>
                Copy the website&apos;s current children, albums, videos, blog posts, chatbot documents and contact details
                into the database so you can edit them here. Safe to run more than once.
              </p>
            </div>
          </div>
          <ImportButton />
        </section>
      ) : null}

      {toMove > 0 ? (
        <section className="panel" style={{ marginBottom: 18 }}>
          <div className="panel__head">
            <div>
              <h2>Move media to cloud storage</h2>
              <p>
                The imported photos and videos are still served from the website&apos;s built-in files. Copy them to Vercel
                Blob so all media is managed in one place. Large videos take a little while; you can leave this page open.
              </p>
            </div>
          </div>
          <MediaMover remaining={toMove} />
        </section>
      ) : null}

      {mode === "local" || mode === "none" ? (
        <p className={`notice ${mode === "none" ? "notice--error" : "notice--warn"}`} style={{ marginBottom: 18 }}>
          <Icon name="info" />
          <span>
            {mode === "none"
              ? "Uploads are disabled: connect a Vercel Blob store to this project (it adds BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN) and redeploy."
              : "Local development: uploads are saved in public/uploads on this computer. On Vercel, connect Blob storage."}
          </span>
        </p>
      ) : null}
      {!process.env.GEMINI_API_KEY ? (
        <p className="notice notice--warn" style={{ marginBottom: 18 }}>
          <Icon name="info" /> <span>The chatbot is off: add GEMINI_API_KEY to the environment variables.</span>
        </p>
      ) : null}

      <div className="stat-cards">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="stat-card">
            <span className="stat-card__icon">
              <Icon name={c.icon} />
            </span>
            <span>
              <strong>{c.value.toLocaleString()}</strong>
              <span>{c.label}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel__head">
            <h2>Visits · last 14 days</h2>
            <Link href="/admin/analytics" className="a-btn a-btn--ghost a-btn--sm">
              Details
            </Link>
          </div>
          <BarChart data={series} label="Page views per day, last 14 days" />
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Latest messages</h2>
            <Link href="/admin/inbox" className="a-btn a-btn--ghost a-btn--sm">
              Open inbox
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="empty">No messages yet.</p>
          ) : (
            <div className="item-list">
              {recent.map((s) => (
                <Link key={s.id} href={`/admin/inbox?open=${s.id}`} className="item" style={{ textDecoration: "none" }}>
                  <span className={`pill ${s.status === "new" ? "pill--new" : ""}`}>{TYPE_LABEL[s.type] ?? s.type}</span>
                  <span className="item__main">
                    <strong>{s.name || s.email || "Anonymous"}</strong>
                    <span>{new Date(s.created_at).toLocaleString()}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel__head">
          <h2>Quick actions</h2>
        </div>
        <div className="btn-group">
          <Link className="a-btn" href="/admin/posts/new">
            <Icon name="send" /> Write a blog post
          </Link>
          <Link className="a-btn a-btn--ghost" href="/admin/albums">
            <Icon name="expand" /> Upload photos
          </Link>
          <Link className="a-btn a-btn--ghost" href="/admin/videos">
            <Icon name="film" /> Add a video
          </Link>
          <Link className="a-btn a-btn--ghost" href="/admin/content">
            <Icon name="book" /> Edit website text
          </Link>
          <Link className="a-btn a-btn--ghost" href="/admin/children">
            <Icon name="handHeart" /> Add a child
          </Link>
        </div>
      </section>
    </>
  );
}
