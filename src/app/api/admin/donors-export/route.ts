import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { dayName, displayPhone } from "@/lib/giving";

// GET /api/admin/donors-export — all donors as a CSV file (signed-in admins only).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const text = String(v ?? "");
  // Quote, and neutralise values a spreadsheet would treat as formulas.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(): Promise<Response> {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const rows = await query<{
    name: string;
    nickname: string;
    phone: string;
    email: string;
    amount: number;
    reminder_day: number;
    status: string;
    locale: string;
    source: string;
    notes: string;
    created_at: string;
    last_paid: string | null;
    total: number;
    payments: number;
  }>(
    `select d.name, d.nickname, d.phone, d.email, d.amount, d.reminder_day, d.status, d.locale, d.source, d.notes, d.created_at::text,
            (select max(p.paid_on)::text from donor_payments p where p.donor_id = d.id) as last_paid,
            (select coalesce(sum(p.amount), 0)::int from donor_payments p where p.donor_id = d.id) as total,
            (select count(*)::int from donor_payments p where p.donor_id = d.id) as payments
     from donors d order by d.created_at`,
  );
  const header = ["Name", "Nickname", "Phone", "Email", "Weekly amount (birr)", "Reminder day", "Status", "Language", "Source", "Registered", "Last payment", "Payments", "Total given (birr)", "Notes"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.nickname,
      r.phone ? displayPhone(r.phone) : "",
      r.email,
      r.amount,
      dayName(r.reminder_day, "en"),
      r.status,
      r.locale === "am" ? "Amharic" : "English",
      r.source,
      r.created_at.slice(0, 10),
      r.last_paid ?? "",
      r.payments,
      r.total,
      r.notes,
    ]
      .map(cell)
      .join(","),
  );
  // BOM so Excel opens Amharic names correctly.
  const csv = `﻿${[header.map(cell).join(","), ...lines].join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="omo-beeza-donors-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
