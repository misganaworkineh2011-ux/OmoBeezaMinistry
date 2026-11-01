import Link from "next/link";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Icon from "@/components/Icon";

export const metadata = { title: "Blog posts" };

export default async function PostsPage() {
  await requireUser();
  const posts = await query<{ id: number; slug: string; title_en: string; title_am: string; date: string | Date; cover: string; published: boolean }>(
    "select id, slug, title_en, title_am, date, cover, published from posts order by date desc, id desc",
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Blog posts</h1>
          <p>News, stories and prayer updates shown on the Blog and Stories pages.</p>
        </div>
        <Link href="/admin/posts/new" className="a-btn a-btn--gold">
          <Icon name="send" /> New post
        </Link>
      </div>

      <section className="panel">
        {posts.length === 0 ? (
          <p className="empty">No posts yet. Write your first one, or import the existing posts from the Overview page.</p>
        ) : (
          <div className="table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th />
                  <th>Title</th>
                  <th>Date</th>
                  <th>Amharic</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td style={{ width: 60 }}>{p.cover ? <img className="thumb" src={p.cover} alt="" /> : null}</td>
                    <td>
                      <strong>{p.title_en}</strong>
                      <div className="a-hint">/blog/{p.slug}</div>
                    </td>
                    <td>{new Date(p.date).toLocaleDateString()}</td>
                    <td>{p.title_am ? <span className="pill pill--ok">Translated</span> : <span className="pill">English only</span>}</td>
                    <td>{p.published ? <span className="pill pill--ok">Published</span> : <span className="pill pill--new">Draft</span>}</td>
                    <td className="num">
                      <Link className="a-btn a-btn--ghost a-btn--sm" href={`/admin/posts/${p.id}`}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
