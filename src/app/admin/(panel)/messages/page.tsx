import { requireUser } from "@/lib/auth";
import { readGivingNow } from "@/lib/data/giving";
import { publicOrigin } from "@/lib/origin";
import { DEFAULT_GIVING, TEMPLATE_KEYS } from "@/lib/giving";
import MessageTemplatesForm from "@/components/admin/MessageTemplatesForm";

export const metadata = { title: "Message templates" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  await requireUser();
  const giving = await readGivingNow();
  const pick = (source: typeof giving) => Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, source[k]])) as Record<(typeof TEMPLATE_KEYS)[number], string>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Message templates</h1>
          <p>The words of the weekly reminders and welcome messages, in English and Amharic.</p>
        </div>
      </div>
      <MessageTemplatesForm initial={pick(giving)} defaults={pick(DEFAULT_GIVING)} yebunaUrl={giving.yebunaUrl} origin={publicOrigin()} />
    </>
  );
}
