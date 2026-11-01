import Link from "next/link";
import knowledge from "@/data/knowledge.json";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadMode } from "@/lib/uploads";
import KnowledgeManager, { type DocRow, type QuestionRow } from "@/components/admin/KnowledgeManager";

export const metadata = { title: "Chatbot" };
export const dynamic = "force-dynamic";

export default async function ChatbotPage() {
  await requireUser();
  const managed = Boolean(await queryOne("select 1 from settings where key = 'knowledge_managed'"));
  const kb = knowledge as { docs: { title: string; chars: number; chunks: number }[] };
  const docs: DocRow[] = managed
    ? await query<DocRow>(
        `select d.id, d.title, d.chars, d.created_at, (select count(*)::int from knowledge_chunks c where c.doc_id = d.id) as passages
         from knowledge_docs d order by d.created_at desc, d.id desc`,
      )
    : kb.docs.map((d) => ({ id: null, title: d.title, chars: d.chars, passages: d.chunks, created_at: null }));
  const questions = await query<QuestionRow>("select question, locale, created_at from chat_logs order by created_at desc limit 60");
  const asked = (await queryOne<{ n: number }>("select count(*)::int as n from chat_logs where created_at > now() - interval '30 days'"))?.n ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Chatbot</h1>
          <p>
            The assistant answers only from these documents. {asked} question{asked === 1 ? "" : "s"} in the last 30 days.
{" "}
            <Link href="/admin/conversations">See full conversations and the questions it couldn’t answer →</Link>
            {process.env.GEMINI_API_KEY ? "" : " ⚠ GEMINI_API_KEY is not set, so the assistant is offline."}
          </p>
        </div>
      </div>
      <KnowledgeManager docs={docs} managed={managed} questions={questions} mode={uploadMode()} />
    </>
  );
}
