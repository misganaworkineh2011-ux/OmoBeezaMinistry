import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readGivingNow } from "@/lib/data/giving";
import { displayPhone } from "@/lib/giving";
import { donorEmail, type DonorForSms } from "@/lib/reminders";
import { emailConfigured } from "@/lib/email";
import { connectLink } from "@/lib/telegram";
import type { DonorInput } from "@/app/admin/actions/donors";
import DonorEditor, { type PaymentRow, type SmsRow } from "@/components/admin/DonorEditor";

export const metadata = { title: "Donor" };
export const dynamic = "force-dynamic";

const EMPTY: DonorInput = { name: "", nickname: "", phone: "", email: "", amount: 100, reminder_day: 0, status: "active", locale: "en", notes: "", telegram_username: "" };

export default async function DonorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const isNew = id === "new";
  const giving = await readGivingNow();

  let donor: (DonorInput & { token: string; source: string; created_at: string; telegram_linked: boolean }) | null = null;
  let payments: PaymentRow[] = [];
  let sms: SmsRow[] = [];
  if (!isNew) {
    if (!/^\d+$/.test(id)) notFound();
    donor = await queryOne(
      "select id, name, nickname, phone, email, amount, reminder_day, status, locale, notes, telegram_username, telegram_chat_id is not null as telegram_linked, token, source, created_at from donors where id = $1",
      [Number(id)],
    );
    if (!donor) notFound();
    [payments, sms] = await Promise.all([
      query<PaymentRow>("select id, amount, paid_on::text, reference, note, created_by from donor_payments where donor_id = $1 order by paid_on desc, id desc", [
        donor.id,
      ]),
      query<SmsRow>("select id, channel, message, kind, status, error, created_at from sms_log where donor_id = $1 order by created_at desc limit 50", [donor.id]),
    ]);
  }

  const preview = donor ? donorEmail("reminder", { ...(donor as DonorForSms), id: donor.id ?? 0 }, giving) : { subject: "", text: "" };

  return (
    <>
      <Link href="/admin/donors" className="crumb">
        ← Donors
      </Link>
      <div className="page-head">
        <div>
          <h1>{donor ? donor.name : "Add a donor"}</h1>
          <p>
            {donor
              ? `${[donor.email, donor.phone ? displayPhone(donor.phone) : ""].filter(Boolean).join(" · ")} · registered ${new Date(donor.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} via ${({ admin: "the dashboard", app: "the app", telegram: "the Telegram bot" } as Record<string, string>)[donor.source] ?? "the website"}`
              : "For people who committed in person or by phone. They will get the weekly reminder too."}
          </p>
        </div>
      </div>
      <DonorEditor
        key={donor?.id ?? "new"}
        donor={donor ? { ...donor, phone: donor.phone ? displayPhone(donor.phone) : "" } : EMPTY}
        payments={payments}
        sms={sms}
        reminderPreview={preview}
        emailReady={emailConfigured()}
        telegram={donor ? { linked: donor.telegram_linked, link: await connectLink(donor.token) } : null}
      />
    </>
  );
}
