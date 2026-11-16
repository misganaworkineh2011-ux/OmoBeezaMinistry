import { hasDb, query, queryOne } from "@/lib/db";
import { readGivingNow } from "@/lib/data/giving";
import { MONTH_DAYS, dayName, normalizePhone, periodWords, scheduleDay, type Frequency, type GivingSettings } from "@/lib/giving";
import { registerDonor } from "@/lib/donors";
import { giveButton } from "@/lib/reminders";
import { sendTelegram, tg, webhookSecret } from "@/lib/telegram";

// POST /api/telegram/webhook — Telegram delivers every message (and button
// press) sent to the ministry's bot here. The bot:
//   • connects a chat to an existing weekly donor, by the personal link from
//     the app / thank-you page (/start <token>), the @username saved with
//     their registration, or the phone number they share;
//   • signs up new donors step by step: phone → name → monthly or weekly →
//     amount → day (of the week or of the month) → language → confirm;
//   • answers /status, /stop, /cancel and /help.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
}
interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  contact?: { phone_number: string; user_id?: number };
}
interface TgCallback {
  id: string;
  from: TgUser;
  data?: string;
  message?: { message_id: number; chat: { id: number; type: string } };
}
interface LinkDonor {
  id: number;
  name: string;
  amount: number;
  reminder_day: number;
  frequency: string;
  month_day: number;
  locale: string;
  status: string;
  telegram_chat_id: string | null;
}
type Lang = "en" | "am";
type Step = "phone" | "name" | "freq" | "amount" | "amount_custom" | "day" | "mday" | "lang" | "confirm";
interface Signup {
  phone?: string;
  name?: string;
  frequency?: Frequency;
  amount?: number;
  day?: number;
  monthDay?: number;
  locale?: Lang;
}

const ok = () => new Response("ok");
const DONOR_COLS = "id, name, amount, reminder_day, frequency, month_day, locale, status, telegram_chat_id";
const birr = (n: number) => n.toLocaleString("en-US");

const T = {
  en: {
    linked: (name: string, amount: string, day: string, period: string) =>
      `Hello ${name}! 🎉 You're connected.\n\nEvery ${day} I'll send you a short reminder for your ${period} gift of ${amount} birr to the children of Omo Beeza. Thank you for standing with them!\n\nSend /stop at any time to stop reminders here.`,
    welcome:
      "Welcome to Omo Beeza Ministry! 👋\n\nI send giving reminders. Already a monthly or weekly giver, or would you like to become one? Tap “Share my phone number” below to start.",
    share: "📱 Share my phone number",
    notOwn: "Please share your own number using the button below.",
    askName: "Thank you! You're not registered yet, so let's sign you up as a regular giver. 🙌\n\nWhat's your full name? Tap your name below or type it.",
    askFreq: "Would you like to give every month or every week?",
    monthly: "📅 Monthly",
    weekly: "🗓 Weekly",
    badName: "Please type your full name (2–80 letters).",
    askAmount: (min: number, every: string) => `How much would you like to give ${every} (in birr)? Choose an amount, or tap “Other” to type one (at least ${min} birr).`,
    other: "Other amount",
    typeAmount: (min: number) => `Type the amount in birr (at least ${min}).`,
    badAmount: (min: number) => `Please type a number of at least ${min} birr.`,
    askDay: "Which day of the week should I remind you?",
    askMonthDay: "Which day of the month should I remind you?",
    askLang: "Which language for your reminders?",
    confirm: (name: string, amount: string, day: string, every: string) =>
      `Please check:\n\n👤 ${name}\n💛 ${amount} birr ${every}\n📅 Reminder every ${day}\n\nYou'll get a short reminder here each time, and you can stop at any time with /stop.`,
    yes: "✅ Confirm",
    restart: "↺ Start over",
    cancelled: "Sign-up cancelled. Send /start whenever you're ready.",
    failed: "Sorry, something went wrong saving your registration. Please try again with /start, or contact us.",
    stopped: "You won't get reminders here any more. Send /start whenever you'd like them back. Thank you for every gift! 🙏",
    status: (amount: string, day: string, state: string, every: string) => `Your gift: ${amount} birr ${every}, reminder every ${day}. Status: ${state}.`,
    notLinked: "This chat isn't connected to a giver yet. Send /start to connect or sign up.",
    help: "I send giving reminders for Omo Beeza Ministry.\n\n/start – connect or sign up\n/status – your gift\n/stop – stop reminders here\n/cancel – cancel signing up",
  },
  am: {
    linked: (name: string, amount: string, day: string, period: string) =>
      `ሰላም ${name}! 🎉 ተገናኝተዋል።\n\nበየ${day} ለኦሞ ቤዛ ልጆች ስለሚሰጡት ${period} የ${amount} ብር ስጦታ አጭር ማሳሰቢያ እልክልዎታለሁ። ከእነርሱ ጋር ስለቆሙ እናመሰግናለን!\n\nማሳሰቢያዎቹን ለማቆም በማንኛውም ጊዜ /stop ይላኩ።`,
    welcome:
      "ወደ ኦሞ ቤዛ ሚኒስትሪ እንኳን ደህና መጡ! 👋\n\nየስጦታ ማሳሰቢያዎችን እልካለሁ። ወርሃዊ ወይም ሳምንታዊ ሰጪ ነዎት ወይስ መሆን ይፈልጋሉ? ለመጀመር ከታች ያለውን “ስልክ ቁጥሬን አጋራ” ይጫኑ።",
    share: "📱 ስልክ ቁጥሬን አጋራ",
    notOwn: "እባክዎ ከታች ባለው ቁልፍ የራስዎን ቁጥር ያጋሩ።",
    askName: "እናመሰግናለን! ገና አልተመዘገቡም፤ እንደ መደበኛ ሰጪ እንመዝግብዎ። 🙌\n\nሙሉ ስምዎ ማን ነው? ከታች ያለውን ስም ይጫኑ ወይም ይጻፉ።",
    askFreq: "በየወሩ ወይስ በየሳምንቱ መስጠት ይፈልጋሉ?",
    monthly: "📅 በየወሩ",
    weekly: "🗓 በየሳምንቱ",
    badName: "እባክዎ ሙሉ ስምዎን ይጻፉ።",
    askAmount: (min: number, every: string) => `${every} ምን ያህል ብር መስጠት ይፈልጋሉ? መጠን ይምረጡ ወይም “ሌላ” ተጭነው ይጻፉ (ቢያንስ ${min} ብር)።`,
    other: "ሌላ መጠን",
    typeAmount: (min: number) => `መጠኑን በብር ይጻፉ (ቢያንስ ${min})።`,
    badAmount: (min: number) => `እባክዎ ቢያንስ ${min} ብር የሆነ ቁጥር ይጻፉ።`,
    askDay: "በሳምንቱ በየትኛው ቀን ላስታውስዎ?",
    askMonthDay: "በወሩ በየትኛው ቀን ላስታውስዎ?",
    askLang: "ማሳሰቢያዎቹ በየትኛው ቋንቋ ይሁኑ?",
    confirm: (name: string, amount: string, day: string, every: string) =>
      `እባክዎ ያረጋግጡ፦\n\n👤 ${name}\n💛 ${every} ${amount} ብር\n📅 ማሳሰቢያ በየ${day}\n\nአጭር ማሳሰቢያ እዚህ ይደርስዎታል፤ በማንኛውም ጊዜ በ /stop ማቆም ይችላሉ።`,
    yes: "✅ አረጋግጥ",
    restart: "↺ እንደገና ጀምር",
    cancelled: "ምዝገባው ተሰርዟል። ሲዘጋጁ /start ይላኩ።",
    failed: "ይቅርታ፣ ምዝገባዎን ማስቀመጥ አልተቻለም። እባክዎ በ /start እንደገና ይሞክሩ ወይም ያግኙን።",
    stopped: "ከእንግዲህ እዚህ ማሳሰቢያ አይደርስዎትም። እንደገና ሲፈልጉ /start ይላኩ። ስለ ስጦታዎ ሁሉ እናመሰግናለን! 🙏",
    status: (amount: string, day: string, state: string, every: string) => `ስጦታዎ፦ ${every} ${amount} ብር፣ ማሳሰቢያ በየ${day}። ሁኔታ፦ ${state}።`,
    notLinked: "ይህ ቻት ገና ከሰጪ ጋር አልተገናኘም። ለመገናኘት ወይም ለመመዝገብ /start ይላኩ።",
    help: "ለኦሞ ቤዛ ሚኒስትሪ የስጦታ ማሳሰቢያዎችን እልካለሁ።\n\n/start – ለመገናኘት ወይም ለመመዝገብ\n/status – ስጦታዎ\n/stop – ማሳሰቢያዎቹን ለማቆም\n/cancel – ምዝገባውን ለመሰረዝ",
  },
};

async function reply(chatId: number, text: string, extra: Record<string, unknown> = {}): Promise<void> {
  await tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true, ...extra });
}

const inline = (rows: { text: string; data: string }[][]) => ({
  reply_markup: { inline_keyboard: rows.map((r) => r.map((b) => ({ text: b.text, callback_data: b.data }))) },
});
const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

async function link(donor: LinkDonor, chatId: number, from: TgUser): Promise<void> {
  await query(
    `update donors set telegram_chat_id = $1, telegram_linked_at = now(), telegram_user_status = 'bot',
       telegram_username = case when $2 <> '' then $2 else telegram_username end
     where id = $3`,
    [String(chatId), from.username?.toLowerCase() ?? "", donor.id],
  );
  await query("delete from telegram_sessions where chat_id = $1", [String(chatId)]);
  const t = T[donor.locale === "am" ? "am" : "en"];
  const giving = await readGivingNow();
  await sendTelegram({
    chatId: String(chatId),
    text: t.linked(
      donor.name.split(/\s+/)[0] ?? donor.name,
      birr(donor.amount),
      scheduleDay(donor.frequency, donor.reminder_day, donor.month_day, donor.locale),
      periodWords(donor.frequency, donor.locale).period,
    ),
    button: giveButton(giving, donor.locale, donor.amount),
    kind: "welcome",
    donorId: donor.id,
    label: `telegram:${donor.name}`,
  });
}

// ---- Sign-up conversation state ------------------------------------------

async function getSession(chatId: number): Promise<{ step: Step; data: Signup } | null> {
  const row = await queryOne<{ step: Step; data: Signup; updated_at: string }>(
    "select step, data, updated_at from telegram_sessions where chat_id = $1",
    [String(chatId)],
  );
  if (!row || Date.now() - new Date(row.updated_at).getTime() > 86_400_000) return null;
  return { step: row.step, data: row.data ?? {} };
}

async function setSession(chatId: number, step: Step, data: Signup): Promise<void> {
  await query(
    `insert into telegram_sessions (chat_id, step, data, updated_at) values ($1, $2, $3, now())
     on conflict (chat_id) do update set step = excluded.step, data = excluded.data, updated_at = now()`,
    [String(chatId), step, JSON.stringify(data)],
  );
}

/** Ask the question for `step` (and remember that we're waiting for it). */
async function ask(chatId: number, step: Step, data: Signup, lang: Lang, giving: GivingSettings, from?: TgUser): Promise<void> {
  const t = T[lang];
  await setSession(chatId, step, data);
  switch (step) {
    case "phone":
      await reply(chatId, t.welcome, {
        reply_markup: { keyboard: [[{ text: t.share, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
      });
      return;
    case "name": {
      const tgName = [from?.first_name, from?.last_name].filter(Boolean).join(" ").trim();
      await reply(
        chatId,
        t.askName,
        tgName
          ? { reply_markup: { keyboard: [[{ text: tgName }]], resize_keyboard: true, one_time_keyboard: true } }
          : { reply_markup: { remove_keyboard: true } },
      );
      return;
    }
    case "freq":
      await reply(chatId, t.askFreq, inline([[{ text: t.monthly, data: "freq:monthly" }, { text: t.weekly, data: "freq:weekly" }]]));
      return;
    case "amount":
      await reply(chatId, t.askAmount(giving.minAmount, periodWords(data.frequency ?? "weekly", lang).every), {
        ...inline([
          ...chunk(giving.amounts.map((a) => ({ text: `${birr(a)} ${lang === "am" ? "ብር" : "birr"}`, data: `amt:${a}` })), 4),
          [{ text: `✏️ ${t.other}`, data: "amt:other" }],
        ]),
      });
      return;
    case "amount_custom":
      await reply(chatId, t.typeAmount(giving.minAmount), { reply_markup: { remove_keyboard: true } });
      return;
    case "day":
      await reply(chatId, t.askDay, inline(chunk([0, 1, 2, 3, 4, 5, 6].map((d) => ({ text: dayName(d, lang), data: `day:${d}` })), 4)));
      return;
    case "mday":
      await reply(chatId, t.askMonthDay, inline(chunk(MONTH_DAYS.map((d) => ({ text: String(d), data: `mday:${d}` })), 7)));
      return;
    case "lang":
      await reply(chatId, t.askLang, inline([[{ text: "English", data: "lang:en" }, { text: "አማርኛ", data: "lang:am" }]]));
      return;
    case "confirm": {
      const l = data.locale ?? lang;
      await reply(
        chatId,
        T[l].confirm(
          data.name ?? "",
          birr(data.amount ?? 0),
          scheduleDay(data.frequency ?? "weekly", data.day ?? 0, data.monthDay ?? 1, l),
          periodWords(data.frequency ?? "weekly", l).every,
        ),
        inline([[{ text: T[l].yes, data: "ok" }, { text: T[l].restart, data: "restart" }]]),
      );
    }
  }
}

async function finishSignup(chatId: number, data: Signup, from: TgUser, lang: Lang): Promise<void> {
  const res = await registerDonor({
    name: data.name,
    phone: data.phone,
    amount: data.amount,
    frequency: data.frequency ?? "weekly",
    day: data.day,
    monthDay: data.monthDay,
    locale: data.locale ?? lang,
    telegram: from.username ?? "",
    source: "telegram",
    requires: "phone",
    noWelcome: true,
  });
  if (!res.ok) {
    await query("delete from telegram_sessions where chat_id = $1", [String(chatId)]);
    await reply(chatId, T[lang].failed);
    return;
  }
  const donor = await queryOne<LinkDonor>(`select ${DONOR_COLS} from donors where id = $1`, [res.donor.id]);
  if (donor) await link(donor, chatId, from);
}

// ---- Webhook --------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret() || !process.env.TELEGRAM_BOT_TOKEN) {
    return new Response("forbidden", { status: 403 });
  }
  if (!hasDb()) return ok();

  let update: { message?: TgMessage; callback_query?: TgCallback };
  try {
    update = (await request.json()) as typeof update;
  } catch {
    return ok();
  }

  try {
    if (update.callback_query) await onButton(update.callback_query);
    else if (update.message && update.message.chat.type === "private" && update.message.from) await onMessage(update.message);
  } catch (err) {
    console.error("telegram webhook:", err);
  }
  return ok();
}

async function context(chatId: number, from: TgUser) {
  const linked = await queryOne<LinkDonor>(`select ${DONOR_COLS} from donors where telegram_chat_id = $1 order by id desc limit 1`, [String(chatId)]);
  const session = await getSession(chatId);
  const lang: Lang = (session?.data.locale ?? linked?.locale ?? (from.language_code === "am" ? "am" : "en")) === "am" ? "am" : "en";
  return { linked, session, lang, giving: await readGivingNow() };
}

async function onMessage(msg: TgMessage): Promise<void> {
  const from = msg.from as TgUser;
  const chatId = msg.chat.id;
  const { linked, session, lang, giving } = await context(chatId, from);
  const t = T[lang];
  const text = (msg.text ?? "").trim();

  // Shared phone number: connect an existing donor, or start signing up.
  if (msg.contact) {
    if (msg.contact.user_id !== from.id) {
      await reply(chatId, t.notOwn, {
        reply_markup: { keyboard: [[{ text: t.share, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
      });
      return;
    }
    const phone = normalizePhone(msg.contact.phone_number);
    const donor = phone ? await queryOne<LinkDonor>(`select ${DONOR_COLS} from donors where phone = $1`, [phone]) : null;
    if (donor) await link(donor, chatId, from);
    else if (phone) await ask(chatId, "name", { phone }, lang, giving, from);
    else await reply(chatId, t.notOwn);
    return;
  }

  if (text.startsWith("/")) {
    const [command, arg = ""] = text.split(/\s+/, 2);
    switch (command.toLowerCase().replace(/@\w+$/, "")) {
      case "/start": {
        // 1) Personal link from the app / thank-you page.
        if (/^[A-Za-z0-9_-]{8,40}$/.test(arg)) {
          const donor = await queryOne<LinkDonor>(`select ${DONOR_COLS} from donors where token = $1`, [arg]);
          if (donor) return link(donor, chatId, from);
        }
        // 2) The @username saved with their registration.
        const username = from.username?.toLowerCase();
        if (username) {
          const donor = await queryOne<LinkDonor>(`select ${DONOR_COLS} from donors where telegram_username = $1 order by id desc limit 1`, [username]);
          if (donor) return link(donor, chatId, from);
        }
        // 3) Already connected.
        if (linked) return link(linked, chatId, from);
        // 4) Ask for their phone number (connects, or starts sign-up).
        return ask(chatId, "phone", {}, lang, giving);
      }
      case "/cancel":
        await query("delete from telegram_sessions where chat_id = $1", [String(chatId)]);
        return reply(chatId, t.cancelled, { reply_markup: { remove_keyboard: true } });
      case "/stop":
        if (linked) await query("update donors set telegram_chat_id = null where telegram_chat_id = $1", [String(chatId)]);
        return reply(chatId, t.stopped, { reply_markup: { remove_keyboard: true } });
      case "/status":
        if (!linked) return reply(chatId, t.notLinked);
        return reply(
          chatId,
          t.status(
            birr(linked.amount),
            scheduleDay(linked.frequency, linked.reminder_day, linked.month_day, linked.locale),
            linked.status,
            periodWords(linked.frequency, linked.locale).every,
          ),
        );
      default:
        return reply(chatId, linked ? t.help : `${t.help}\n\n${t.notLinked}`);
    }
  }

  // Answers to sign-up questions.
  if (session?.step === "name") {
    const name = text.replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 80 || /[<>{}]/.test(name)) return reply(chatId, t.badName);
    return ask(chatId, "freq", { ...session.data, name }, lang, giving);
  }
  if (session?.step === "amount_custom") {
    const amount = Math.round(Number(text.replace(/[^\d.]/g, "")));
    if (!(amount >= giving.minAmount && amount <= 1_000_000)) return reply(chatId, t.badAmount(giving.minAmount));
    return ask(chatId, session.data.frequency === "monthly" ? "mday" : "day", { ...session.data, amount }, lang, giving);
  }
  if (session) return ask(chatId, session.step, session.data, lang, giving, from); // repeat the question

  await reply(chatId, linked ? t.help : `${t.help}\n\n${t.notLinked}`);
}

async function onButton(cb: TgCallback): Promise<void> {
  await tg("answerCallbackQuery", { callback_query_id: cb.id });
  const chatId = cb.message?.chat.id;
  if (!chatId || cb.message?.chat.type !== "private") return;
  // Remove the buttons that were just used.
  await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });

  const { session, lang, giving } = await context(chatId, cb.from);
  if (!session) return reply(chatId, T[lang].cancelled);
  const [key, value = ""] = (cb.data ?? "").split(":");
  const data = session.data;

  if (key === "freq" && session.step === "freq" && (value === "monthly" || value === "weekly")) {
    return ask(chatId, "amount", { ...data, frequency: value }, lang, giving);
  }
  if (key === "amt" && session.step === "amount") {
    if (value === "other") return ask(chatId, "amount_custom", data, lang, giving);
    const amount = Number(value);
    if (giving.amounts.includes(amount)) return ask(chatId, data.frequency === "monthly" ? "mday" : "day", { ...data, amount }, lang, giving);
  }
  if (key === "day" && session.step === "day") {
    const day = Number(value);
    if (day >= 0 && day <= 6) return ask(chatId, "lang", { ...data, day }, lang, giving);
  }
  if (key === "mday" && session.step === "mday") {
    const monthDay = Number(value);
    if (monthDay >= 1 && monthDay <= 28) return ask(chatId, "lang", { ...data, monthDay }, lang, giving);
  }
  if (key === "lang" && session.step === "lang" && (value === "en" || value === "am")) {
    return ask(chatId, "confirm", { ...data, locale: value }, value, giving);
  }
  if (key === "restart") return ask(chatId, "name", { phone: data.phone }, lang, giving, cb.from);
  if (key === "ok" && session.step === "confirm") return finishSignup(chatId, data, cb.from, data.locale ?? lang);
  // A stale button: ask the current question again.
  return ask(chatId, session.step, data, lang, giving, cb.from);
}
