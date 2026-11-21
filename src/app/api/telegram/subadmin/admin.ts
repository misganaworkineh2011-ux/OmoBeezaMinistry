import "server-only";
import { hashPassword } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { readGivingNow } from "@/lib/data/giving";
import { emailConfigured } from "@/lib/email";
import { displayPhone, ethiopiaToday, normalizePhone, periodWords, scheduleDay } from "@/lib/giving";
import { endRegistrarSessions, REGISTRAR_SELECT, registrarPasswordProblem, type RegistrarRow } from "@/lib/registrars";
import { donorMessage, emailDonor, giveButton, runReminders, type DonorForSms } from "@/lib/reminders";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { subBot } from "@/lib/telegram-subadmin";
import { birr, chunk, endSession, inline, reply, setSession, type Actor, type Data, type Step } from "./core";

// The admin tools of the team Telegram bot (admins sign in with their
// dashboard email and password): overview, register and find donors, record
// payments, pause / stop / remind a donor, send today's reminders, and manage
// sub-admins (add, extend targets, pause). In English, like the dashboard.

type Admin = Extract<Actor, { role: "admin" }>;

export const ADMIN_MENU = {
  register: "➕ Register a donor",
  find: "🔎 Find a donor",
  overview: "📊 Overview",
  subs: "👥 Sub-admins",
  remind: "🔔 Send reminders",
};

export const ADMIN_HELP =
  "Admin tools:\n\n/overview – numbers at a glance\n/register – register a donor\n/find – find a donor (payments, pause, remind)\n/subadmins – sub-admins and their targets\n/remind – send today's reminders\n/cancel – stop the current step\n/logout – sign out";

export const adminKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: ADMIN_MENU.register }, { text: ADMIN_MENU.find }],
      [{ text: ADMIN_MENU.overview }, { text: ADMIN_MENU.subs }],
      [{ text: ADMIN_MENU.remind }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  },
};

/** Menu button text → command. */
export function adminCommandFor(text: string): string {
  switch (text) {
    case ADMIN_MENU.register:
      return "/register";
    case ADMIN_MENU.find:
      return "/find";
    case ADMIN_MENU.overview:
      return "/overview";
    case ADMIN_MENU.subs:
      return "/subadmins";
    case ADMIN_MENU.remind:
      return "/remind";
    default:
      return "";
  }
}

const cancelRow = [{ text: "✖ Cancel", data: "cancel" }];
const ethiopiaDate = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

// ---- Overview ---------------------------------------------------------------

export async function showOverview(chatId: number, before = ""): Promise<void> {
  const { weekday, monthDay } = ethiopiaToday();
  const s = await queryOne<{
    active: number;
    monthly: number;
    weekly: number;
    today: number;
    week: number;
    paid: number;
    due: number;
    telegram: number;
    subs: number;
    subRegistered: number;
    subTarget: number;
  }>(
    `select (select count(*)::int from donors where deleted_at is null and status = 'active') as active,
            (select coalesce(sum(amount), 0)::int from donors where deleted_at is null and status = 'active' and frequency = 'monthly') as monthly,
            (select coalesce(sum(amount), 0)::int from donors where deleted_at is null and status = 'active' and frequency <> 'monthly') as weekly,
            (select count(*)::int from donors where deleted_at is null and created_at > now() - interval '24 hours') as today,
            (select count(*)::int from donors where deleted_at is null and created_at > now() - interval '7 days') as week,
            (select count(*)::int from donors d where d.status = 'active' and d.deleted_at is null and exists (select 1 from donor_payments p where p.donor_id = d.id
               and p.paid_on > current_date - (case when d.frequency = 'monthly' then 31 else 7 end))) as paid,
            (select count(*)::int from donors where deleted_at is null and status = 'active'
               and ((frequency = 'monthly' and month_day = $2) or (frequency <> 'monthly' and reminder_day = $1))
               and (last_reminded_at is null or last_reminded_at < now() - interval '20 hours')) as due,
            (select count(*)::int from donors where deleted_at is null and status = 'active' and telegram_chat_id is not null) as telegram,
            (select count(*)::int from registrars where status = 'active') as subs,
            (select count(*)::int from donors where deleted_at is null and registered_by in (select id from registrars where status = 'active')) as "subRegistered",
            (select coalesce(sum(target), 0)::int from registrars where status = 'active') as "subTarget"`,
    [weekday, monthDay],
  );
  const v = s ?? { active: 0, monthly: 0, weekly: 0, today: 0, week: 0, paid: 0, due: 0, telegram: 0, subs: 0, subRegistered: 0, subTarget: 0 };
  const text =
    `📊 Overview\n\n` +
    `👥 Active donors: ${v.active} (${v.telegram} on Telegram)\n` +
    `💛 ${birr(v.monthly)} birr a month + ${birr(v.weekly)} birr a week\n` +
    `✅ Paid this period: ${v.paid} of ${v.active}\n` +
    `🆕 New: ${v.today} today, ${v.week} this week\n` +
    `🔔 Reminders still due today: ${v.due}\n` +
    `🧑‍🤝‍🧑 Sub-admins: ${v.subs} active, ${v.subRegistered} of ${v.subTarget} donors registered`;
  await reply(chatId, before ? `${before}\n\n${text}` : text, adminKeyboard);
}

// ---- Donors ----------------------------------------------------------------

interface DonorCardRow extends DonorForSms {
  email: string;
  status: string;
  source: string;
  created_at: string;
  last_paid: string | null;
  total: number;
  last_reminded_at: string | null;
  registered_by_name: string | null;
}

export async function startFind(chatId: number): Promise<void> {
  await setSession(chatId, "a_find", {});
  await reply(chatId, "🔎 Type part of the donor's name or phone number.", inline([cancelRow]));
}

async function findDonors(chatId: number, text: string): Promise<void> {
  const q = text.trim().slice(0, 80);
  const digits = q.replace(/\D/g, "").replace(/^(251|0)/, "");
  const rows = await query<{ id: number; name: string; phone: string; amount: number; frequency: string; status: string }>(
    `select id, name, phone, amount, frequency, status from donors
     where deleted_at is null and (name ilike '%' || $1 || '%' or lower(email) like '%' || lower($1) || '%' or ($2 <> '' and length($2) >= 3 and phone like '%' || $2 || '%'))
     order by status = 'active' desc, created_at desc limit 9`,
    [q, digits],
  );
  if (rows.length === 0) {
    return reply(chatId, "No donor matches that. Type another name or number, or tap Cancel.", inline([cancelRow]));
  }
  await endSession(chatId);
  if (rows.length === 1) return donorCard(chatId, rows[0].id);
  const shown = rows.slice(0, 8);
  await reply(
    chatId,
    `Found ${rows.length > 8 ? "more than 8" : rows.length} donors${rows.length > 8 ? " (type more of the name to narrow it down)" : ""}. Choose one:`,
    inline(
      shown.map((d) => [
        {
          text: `${d.name} · ${d.phone ? displayPhone(d.phone) : "no phone"} · ${birr(d.amount)}/${d.frequency === "monthly" ? "mo" : "wk"}${d.status === "active" ? "" : ` · ${d.status}`}`,
          data: `d:${d.id}`,
        },
      ]),
    ),
  );
}

export async function donorCard(chatId: number, id: number, before = ""): Promise<void> {
  const d = await queryOne<DonorCardRow>(
    `select d.id, d.name, d.nickname, d.phone, d.email, d.amount, d.reminder_day, d.frequency, d.month_day, d.locale, d.token, d.telegram_chat_id,
            d.status, d.source, d.created_at, d.last_reminded_at,
            (select max(p.paid_on)::text from donor_payments p where p.donor_id = d.id) as last_paid,
            (select coalesce(sum(p.amount), 0)::int from donor_payments p where p.donor_id = d.id) as total,
            (select r.name from registrars r where r.id = d.registered_by) as registered_by_name
     from donors d where d.id = $1 and d.deleted_at is null`,
    [id],
  );
  if (!d) return reply(chatId, "That donor no longer exists.", adminKeyboard);
  const freq = d.frequency ?? "weekly";
  const lines = [
    `👤 ${d.name}${d.nickname ? ` (“${d.nickname}”)` : ""}`,
    d.phone ? `📱 ${displayPhone(d.phone)}` : "",
    d.email ? `✉️ ${d.email}` : "",
    `💛 ${birr(d.amount)} birr ${periodWords(freq, "en").every}, reminder every ${scheduleDay(freq, d.reminder_day, d.month_day ?? 1, "en")} (${d.locale === "am" ? "Amharic" : "English"})`,
    `📌 Status: ${d.status}${d.telegram_chat_id ? " · on Telegram" : ""}`,
    `💵 Last payment: ${d.last_paid ? shortDate(d.last_paid) : "none recorded"} · total ${birr(d.total)} birr`,
    `🔔 Last reminder: ${shortDate(d.last_reminded_at)}`,
    `🗂 Since ${shortDate(d.created_at)}${d.registered_by_name ? `, by ${d.registered_by_name}` : d.source === "website" ? ", on the website" : ""}`,
  ].filter(Boolean);
  const statusRow =
    d.status === "active"
      ? [
          { text: "⏸ Pause", data: `st:${d.id}:paused` },
          { text: "⛔ Stop", data: `st:${d.id}:stopped` },
        ]
      : [{ text: "▶️ Resume reminders", data: `st:${d.id}:active` }];
  await reply(
    chatId,
    `${before ? `${before}\n\n` : ""}${lines.join("\n")}`,
    inline([
      [
        { text: `💵 Paid ${birr(d.amount)} today`, data: `pay:${d.id}:${d.amount}` },
        { text: "✏️ Other amount", data: `payo:${d.id}` },
      ],
      statusRow,
      [{ text: "📨 Send reminder now", data: `rem:${d.id}` }],
    ]),
  );
}

async function recordPayment(chatId: number, admin: Admin, id: number, amount: number): Promise<void> {
  if (!(amount > 0 && amount <= 10_000_000)) return reply(chatId, "Please type an amount in birr, like 500.");
  const ok = await queryOne("select 1 from donors where id = $1 and deleted_at is null", [id]);
  if (!ok) return reply(chatId, "That donor no longer exists.", adminKeyboard);
  await query("insert into donor_payments (donor_id, amount, paid_on, reference, note, created_by) values ($1, $2, $3, '', 'Telegram bot', $4)", [
    id,
    amount,
    ethiopiaDate(),
    admin.name,
  ]);
  await endSession(chatId);
  await donorCard(chatId, id, `✅ Recorded ${birr(amount)} birr received today.`);
}

async function setDonorStatus(chatId: number, id: number, status: string): Promise<void> {
  if (!["active", "paused", "stopped"].includes(status)) return;
  await query(
    `update donors set status = $2, stopped_at = case when $2 = 'stopped' then coalesce(stopped_at, now()) else null end where id = $1`,
    [id, status],
  );
  await donorCard(chatId, id, status === "active" ? "▶️ Reminders resumed." : status === "paused" ? "⏸ Paused: no reminders until you resume." : "⛔ Stopped.");
}

async function remindDonor(chatId: number, id: number): Promise<void> {
  const d = await queryOne<DonorForSms & { email: string }>(
    "select id, name, nickname, phone, email, amount, reminder_day, frequency, month_day, locale, token, telegram_chat_id from donors where id = $1",
    [id],
  );
  if (!d) return reply(chatId, "That donor no longer exists.", adminKeyboard);
  const giving = await readGivingNow();
  let res: { ok: boolean; error?: string } | null = null;
  let via = "";
  if (d.telegram_chat_id && telegramConfigured()) {
    res = await sendTelegram({
      chatId: d.telegram_chat_id,
      text: donorMessage("reminder", d, giving, "telegram"),
      button: giveButton(giving, d.locale, d.amount),
      kind: "manual",
      donorId: d.id,
      label: `telegram:${d.name}`,
    });
    via = "Telegram";
  }
  if (!res?.ok && d.email && emailConfigured()) {
    res = await emailDonor("reminder", d, giving);
    via = "email";
  }
  if (!res) {
    return donorCard(chatId, id, d.phone ? "📵 This donor isn't on Telegram and has no email: send their reminder as SMS from the app (Send SMS reminders)." : "No way to reach this donor.");
  }
  if (res.ok) await query("update donors set last_reminded_at = now() where id = $1", [id]);
  await donorCard(chatId, id, res.ok ? `📨 Reminder sent by ${via}.` : `⚠️ Not sent: ${res.error ?? "failed"}`);
}

// ---- Reminders ---------------------------------------------------------------

export async function showRemind(chatId: number): Promise<void> {
  const { weekday, monthDay } = ethiopiaToday();
  const due =
    (
      await queryOne<{ n: number }>(
        `select count(*)::int as n from donors where deleted_at is null and status = 'active'
         and ((frequency = 'monthly' and month_day = $2) or (frequency <> 'monthly' and reminder_day = $1))
         and (last_reminded_at is null or last_reminded_at < now() - interval '20 hours')`,
        [weekday, monthDay],
      )
    )?.n ?? 0;
  if (due === 0) return reply(chatId, "🔔 Nobody is due a reminder today (or they've all had theirs).", adminKeyboard);
  await reply(
    chatId,
    `🔔 ${due} donor${due === 1 ? " is" : "s are"} due a reminder today. They are sent automatically every morning; send them now by Telegram and email?\n\n(Donors with only a phone number get theirs as SMS from the app.)`,
    inline([[{ text: `📨 Send ${due} now`, data: "remrun" }], cancelRow]),
  );
}

async function runRemindersNow(chatId: number): Promise<void> {
  await reply(chatId, "Sending… this can take a minute.");
  const run = await runReminders();
  if (run.disabled) return reply(chatId, "Automatic reminders are turned off (Dashboard → Giving & reminders).", adminKeyboard);
  await reply(
    chatId,
    `✅ Done: ${run.telegram} by Telegram, ${run.sent} by email, ${run.skippedPaid} skipped (already paid), ${run.failed} failed.` +
      (run.phoneOnly ? `\n📵 ${run.phoneOnly} with only a phone number: send theirs with “Send SMS reminders” in the app.` : ""),
    adminKeyboard,
  );
}

// ---- Sub-admins ----------------------------------------------------------------

export async function showSubs(chatId: number, before = ""): Promise<void> {
  const rows = await query<RegistrarRow>(`${REGISTRAR_SELECT} order by r.status = 'active' desc, r.created_at desc limit 30`);
  const lines = rows.map(
    (r) => `${r.registered >= r.target && r.target > 0 ? "🎉" : "•"} ${r.name}: ${r.registered} of ${r.target}${r.status === "active" ? "" : " (paused)"}`,
  );
  await reply(
    chatId,
    `${before ? `${before}\n\n` : ""}👥 Sub-admins (${rows.length})\n\n${lines.join("\n") || "None yet."}\n\nChoose one to extend their target or pause them.`,
    inline([...chunk(rows.map((r) => ({ text: r.name, data: `s:${r.id}` })), 2), [{ text: "➕ Add a sub-admin", data: "subadd" }]]),
  );
}

async function subCard(chatId: number, id: number, before = ""): Promise<void> {
  const r = await queryOne<RegistrarRow>(`${REGISTRAR_SELECT} where r.id = $1`, [id]);
  if (!r) return reply(chatId, "That sub-admin no longer exists.", adminKeyboard);
  const tg = await queryOne("select 1 from registrar_telegram where registrar_id = $1", [id]);
  const text = [
    `👤 ${r.name}`,
    `📱 ${displayPhone(r.phone)}`,
    `🎯 ${r.registered} of ${r.target} donors registered${r.target > 0 && r.registered >= r.target ? " 🎉 target reached" : ""}`,
    `📌 ${r.status === "active" ? "Active" : "Paused"}${tg ? " · on Telegram" : ""} · last sign-in ${shortDate(r.last_login)}`,
  ].join("\n");
  await reply(
    chatId,
    `${before ? `${before}\n\n` : ""}${text}`,
    inline([
      [
        { text: "+5", data: `sx:${id}:5` },
        { text: "+10", data: `sx:${id}:10` },
        { text: "✏️ Other", data: `sxo:${id}` },
      ],
      [r.status === "active" ? { text: "⏸ Pause", data: `sp:${id}:paused` } : { text: "▶️ Resume", data: `sp:${id}:active` }],
      [{ text: "◀ All sub-admins", data: "subs" }],
    ]),
  );
}

async function extendSub(chatId: number, id: number, n: number): Promise<void> {
  if (!(n >= 1 && n <= 100_000)) return reply(chatId, "Please type a number of 1 or more.");
  await endSession(chatId);
  const row = await queryOne<{ target: number }>(
    `update registrars set target = least(100000, greatest(target, (select count(*)::int from donors where registered_by = $1 and deleted_at is null)) + $2)
     where id = $1 returning target`,
    [id, n],
  );
  if (!row) return reply(chatId, "That sub-admin no longer exists.", adminKeyboard);
  await subCard(chatId, id, `✅ Target is now ${row.target}.`);
}

async function setSubStatus(chatId: number, id: number, status: string): Promise<void> {
  if (status !== "active" && status !== "paused") return;
  await query("update registrars set status = $2 where id = $1", [id, status]);
  if (status === "paused") await endRegistrarSessions(id);
  await subCard(chatId, id, status === "paused" ? "⏸ Paused and signed out of the app and the bot." : "▶️ They can sign in again.");
}

// ---- Entry points (called from route.ts) ---------------------------------------

/** A typed answer to one of the admin questions. Returns false when it isn't one. */
export async function adminAnswer(chatId: number, admin: Admin, step: Step, data: Data, text: string, messageId: number): Promise<boolean> {
  switch (step) {
    case "a_find":
      await findDonors(chatId, text);
      return true;
    case "a_pay":
      await recordPayment(chatId, admin, data.did ?? 0, Math.round(Number(text.replace(/[^\d.]/g, ""))));
      return true;
    case "a_ext":
      await extendSub(chatId, data.sid ?? 0, Math.round(Number(text.replace(/[^\d]/g, ""))));
      return true;
    case "a_sub_name": {
      const name = text.replace(/\s+/g, " ").trim().slice(0, 80);
      if (name.length < 2) {
        await reply(chatId, "Please type their full name.");
        return true;
      }
      await setSession(chatId, "a_sub_phone", { subName: name });
      await reply(chatId, `Their mobile number? They will sign in with it (e.g. 0911 234 567).`, inline([cancelRow]));
      return true;
    }
    case "a_sub_phone": {
      const phone = normalizePhone(text);
      if (!phone) {
        await reply(chatId, "That isn't an Ethiopian mobile number. Please type it like 0911 234 567.");
        return true;
      }
      if (await queryOne("select 1 from registrars where phone = $1", [phone])) {
        await reply(chatId, "A sub-admin with this number already exists. Type another number, or Cancel.");
        return true;
      }
      await setSession(chatId, "a_sub_pass", { ...data, subPhone: phone });
      await reply(chatId, "Type a password for them (at least 8 characters). I'll delete your message right away; give it to them yourself.", inline([cancelRow]));
      return true;
    }
    case "a_sub_pass": {
      await subBot("deleteMessage", { chat_id: chatId, message_id: messageId });
      if (registrarPasswordProblem(text)) {
        await reply(chatId, "The password needs at least 8 characters. Type another one.");
        return true;
      }
      await setSession(chatId, "a_sub_target", { ...data, subHash: await hashPassword(text) });
      await reply(chatId, "Password saved ✅. How many donors should they register (their target)?", inline([[{ text: "10", data: "subt:10" }, { text: "20", data: "subt:20" }, { text: "50", data: "subt:50" }], cancelRow]));
      return true;
    }
    case "a_sub_target":
      await addSub(chatId, admin, data, Math.round(Number(text.replace(/[^\d]/g, ""))));
      return true;
    default:
      return false;
  }
}

async function addSub(chatId: number, admin: Admin, data: Data, target: number): Promise<void> {
  if (!(target >= 0 && target <= 100_000)) return reply(chatId, "Please type a number from 0 to 100,000.");
  if (!data.subName || !data.subPhone || !data.subHash) {
    await endSession(chatId);
    return reply(chatId, "Something went missing. Please start again with “Add a sub-admin”.", adminKeyboard);
  }
  await endSession(chatId);
  if (await queryOne("select 1 from registrars where phone = $1", [data.subPhone])) {
    return reply(chatId, "A sub-admin with this number already exists.", adminKeyboard);
  }
  const row = await queryOne<{ id: number }>(
    "insert into registrars (name, phone, password_hash, target, created_by) values ($1, $2, $3, $4, $5) returning id",
    [data.subName, data.subPhone, data.subHash, target, admin.id],
  );
  await reply(
    chatId,
    `✅ ${data.subName} was added with a target of ${target}.\n\nTell them to sign in with ${displayPhone(data.subPhone)} and the password you chose: in the Omo Beeza app (Android) or in this bot (iPhone: tap Start, then “Share my phone number”).`,
    adminKeyboard,
  );
  if (row) await subCard(chatId, row.id);
}

/** An admin button. Returns false when it isn't one. */
export async function adminButton(chatId: number, admin: Admin, key: string, parts: string[]): Promise<boolean> {
  const id = Number(parts[0]);
  switch (key) {
    case "d":
      await donorCard(chatId, id);
      return true;
    case "pay":
      await recordPayment(chatId, admin, id, Number(parts[1]));
      return true;
    case "payo":
      await setSession(chatId, "a_pay", { did: id });
      await reply(chatId, "How much was received (birr)? It is recorded with today's date.", inline([cancelRow]));
      return true;
    case "st":
      await setDonorStatus(chatId, id, parts[1] ?? "");
      return true;
    case "rem":
      await remindDonor(chatId, id);
      return true;
    case "remrun":
      await runRemindersNow(chatId);
      return true;
    case "subs":
      await showSubs(chatId);
      return true;
    case "s":
      await subCard(chatId, id);
      return true;
    case "sx":
      await extendSub(chatId, id, Number(parts[1]));
      return true;
    case "sxo":
      await setSession(chatId, "a_ext", { sid: id });
      await reply(chatId, "How many more donors should they register? Type a number.", inline([cancelRow]));
      return true;
    case "sp":
      await setSubStatus(chatId, id, parts[1] ?? "");
      return true;
    case "subadd":
      await setSession(chatId, "a_sub_name", {});
      await reply(chatId, "New sub-admin ✍️\n\nWhat is their full name?", inline([cancelRow]));
      return true;
    default:
      return false;
  }
}

/** The "subt:20" target buttons while adding a sub-admin. */
export async function adminTargetButton(chatId: number, admin: Admin, data: Data, value: number): Promise<void> {
  await addSub(chatId, admin, data, value);
}
