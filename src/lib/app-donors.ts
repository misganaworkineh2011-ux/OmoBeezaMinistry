import "server-only";
import { botUsername } from "@/lib/telegram";

// How the Android app sees a donor (list, register and edit endpoints).

export interface AppDonor {
  id: number;
  name: string;
  nickname: string;
  phone: string;
  email: string;
  amount: number;
  reminder_day: number;
  frequency: string;
  month_day: number;
  locale: string;
  status: string;
  source: string;
  notes: string;
  created_at: string;
  last_reminded_at: string | null;
  last_paid: string | null;
  total: number;
  telegram_username: string;
  telegram_linked: boolean;
  /** The sub-admin who registered them ("" = not a sub-admin). */
  registered_by_name: string;
  token?: string;
  telegram_link?: string;
}

/** Adds each donor's one-tap Telegram link (and drops the raw token). */
export async function withLinks(donors: AppDonor[]): Promise<AppDonor[]> {
  const bot = await botUsername();
  return donors.map(({ token, ...d }) => ({ ...d, telegram_link: bot && token ? `https://t.me/${bot}?start=${token}` : "" }));
}

export const APP_DONOR_SELECT = `select d.id, d.name, d.nickname, d.phone, d.email, d.amount, d.reminder_day, d.frequency, d.month_day, d.locale, d.status, d.source, d.notes,
  d.created_at, d.last_reminded_at, d.telegram_username, d.telegram_chat_id is not null as telegram_linked, d.token,
  coalesce((select r.name from registrars r where r.id = d.registered_by), '') as registered_by_name,
  (select max(p.paid_on)::text from donor_payments p where p.donor_id = d.id) as last_paid,
  (select coalesce(sum(p.amount), 0)::int from donor_payments p where p.donor_id = d.id) as total
  from donors d`;
