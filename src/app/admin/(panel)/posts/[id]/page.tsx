import Link from "next/link";
import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadMode } from "@/lib/uploads";
import type { PostInput } from "@/app/admin/actions/posts";
import PostEditor from "@/components/admin/PostEditor";

export const metadata = { title: "Edit post" };

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  let post: PostInput;
  if (id === "new") {
    post = {
      slug: "",
      date: new Date().toISOString().slice(0, 10),
      cover: "",
      author: "Omo Beeza Ministry",
      title_en: "",
      title_am: "",
      excerpt_en: "",
      excerpt_am: "",
      body_en: "",
      body_am: "",
      published: true,
    };
  } else {
    const row = await queryOne<PostInput & { date: string | Date }>("select * from posts where id = $1", [Number(id) || 0]);
    if (!row) notFound();
    post = {
      id: row.id,
      slug: row.slug,
      date: new Date(row.date).toISOString().slice(0, 10),
      cover: row.cover,
      author: row.author,
      title_en: row.title_en,
      title_am: row.title_am,
      excerpt_en: row.excerpt_en,
      excerpt_am: row.excerpt_am,
      body_en: row.body_en,
      body_am: row.body_am,
      published: row.published,
    };
  }

  return (
    <>
      <Link href="/admin/posts" className="crumb">
        ← Blog posts
      </Link>
      <div className="page-head">
        <div>
          <h1>{post.id ? "Edit post" : "New post"}</h1>
          <p>Write in English; add the Amharic version in the second tab (optional).</p>
        </div>
      </div>
      <PostEditor initial={post} mode={uploadMode()} />
    </>
  );
}
