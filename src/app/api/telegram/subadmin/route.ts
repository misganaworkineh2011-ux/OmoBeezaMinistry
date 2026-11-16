import { hasDb, query, queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { readGivingNow } from "@/lib/data/giving";
import { dayName, displayPhone, isEmail, normalizePhone, type GivingSettings } from "@/lib/giving";
import { registerDonor } from "@/lib/donors";
import { limited } from "@/lib/ratelimit";
import { donorMessage, giveLink } from "@/lib/reminders";
import { subBot, subBotSecret } from "@/lib/telegram-subadmin";

// POST /api/telegram/subadmin — the sub-admin Telegram bot, for sub-admins
// without an Android phone (iPhone users). The same as the Sub-admin app:
//   • sign in once: share their phone number, then type their password;
//   • register donors step by step: name → phone → weekly amount → day →
//     language → email (optional) → confirm. It counts toward their target, and
//     a number that is already registered is refused;
//   • after each registration, a message to forward to the donor (thank-you
//     and payment link);
//   • see their progress and the donors they registered; sign out.
// Pausing a sub-admin, changing their password or removing them (Admin app)
// signs them out of the bot too.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
}
interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  contact?: { phone_number: string; first_name?: string; last_name?: string; user_id?: number };
}
interface TgCallback {
  id: string;
  from: TgUser;
  data?: string;
  message?: { message_id: number; chat: { id: number; type: string } };
}
interface Me {
  id: number;
  name: string;
  target: number;
  status: string;
  lang: Lang;
}
type Lang = "en" | "am";
type Step = "password" | "name" | "phone" | "amount" | "amount_custom" | "day" | "lang" | "email" | "confirm";
interface Data {
  /** Signing in: the sub-admin whose password we're waiting for. */
  rid?: number;
  ui?: Lang;
  name?: string;
  phone?: string;
  amount?: number;
  day?: number;
  locale?: Lang;
  email?: string;
}

const ok = () => new Response("ok");
const birr = (n: number) => n.toLocaleString("en-US");
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const T = {
  en: {
    welcome:
      "Welcome to the Omo Beeza sub-admin bot! 👋\n\nHere you register weekly donors for Omo Beeza Ministry. To sign in, tap “Share my phone number” below (the number the admin registered you with).",
    share: "📱 Share my phone number",
    notOwn: "Please share your own number with the button below.",
    notSubAdmin: "This number isn't registered as a sub-admin. Please ask the ministry's admin to add you, then send /start again.",
    paused: "Your sub-admin account is paused. Please contact the ministry's admin.",
    askPassword: "Thank you! Now type your password (the same one as for the Sub-admin app). I'll delete your message right after reading it.",
    badPassword: "That password isn't right. Please try again, or send /cancel.",
    tooMany: "Too many attempts. Please wait 15 minutes and try again.",
    signedIn: (name: string) => `You're signed in, ${name}! 🎉`,
    signedOut: "You're signed out. Send /start to sign in again.",
    menu: { register: "➕ Register a donor", progress: "📊 My progress", donors: "📋 My donors" },
    progress: (registered: number, target: number, today: number) =>
      target > 0
        ? `📊 You've registered ${registered} of ${target} donors${today ? ` (${today} in the last 24 hours)` : ""}.\n${
            registered >= target ? "🎉 You've reached your target. Thank you!" : `${target - registered} to go.`
          }`
        : `📊 You've registered ${registered} donor${registered === 1 ? "" : "s"}${today ? ` (${today} in the last 24 hours)` : ""}.`,
    noDonors: "You haven't registered any donors yet. Tap “Register a donor” to start.",
    donorsTitle: (shown: number, total: number) => (shown < total ? `Your latest ${shown} of ${total} donors:` : `Your donors (${total}):`),
    askName: "New donor ✍️\n\nWhat is the donor's full name?\n\n(Send /cancel at any time to stop.)",
    badName: "Please type the donor's full name (2–80 letters).",
    askPhone: "The donor's phone number? For example 0911 234 567. You can also send their contact card.",
    badPhone: "That isn't an Ethiopian mobile number. Please type it like 0911 234 567.",
    taken: "This phone number is already registered as a donor. Please type a different number, or /cancel.",
    askAmount: (min: number) => `How much will they give every week (birr)? Choose, or tap “Other” to type an amount (at least ${min} birr).`,
    other: "✏️ Other",
    typeAmount: (min: number) => `Type the weekly amount in birr (at least ${min}).`,
    badAmount: (min: number) => `Please type a number of at least ${min} birr.`,
    askDay: "Which day of the week should we remind them?",
    askLang: "Which language for their messages?",
    askEmail: "The donor's email address (optional). Reminders are emailed automatically. Type it, or tap “Skip”.",
    skip: "Skip",
    badEmail: "That doesn't look like an email address. Type it again, or tap “Skip”.",
    confirm: (d: Required<Pick<Data, "name" | "phone" | "amount">> & Data, day: string) =>
      `Please check:\n\n👤 ${d.name}\n📱 ${displayPhone(d.phone)}\n💛 ${birr(d.amount)} birr every week\n📅 Reminder every ${day}\n🌐 ${
        d.locale === "am" ? "Amharic" : "English"
      }${d.email ? `\n✉️ ${d.email}` : ""}\n\nBy confirming, you confirm that the donor agreed to receive weekly reminders (they can stop at any time).`,
    yes: "✅ Confirm",
    restart: "↺ Start over",
    cancel: "✖ Cancel",
    cancelled: "Cancelled.",
    saved: (name: string) => `✅ ${name} is registered. Thank you!`,
    forward: (name: string) => `👇 Forward the next message to ${name} (or tap the button to send it on Telegram).`,
    sendTg: "📤 Send on Telegram",
    reminders: "Weekly reminders on Telegram (tap Start):",
    failed: {
      already_registered: "This phone number is already registered as a donor.",
      save_failed: "Sorry, saving failed. Please try again.",
      other: "Something in the details wasn't right. Please start again.",
    },
    notSignedIn: "Please sign in first: send /start.",
    langSet: "Language: English.",
    help: "Sub-admin bot for Omo Beeza Ministry.\n\n/register – register a donor\n/progress – your progress\n/donors – the donors you registered\n/cancel – stop the current step\n/language – English / አማርኛ\n/logout – sign out",
    unavailable: "The bot isn't available right now. Please try again later.",
  },
  am: {
    welcome:
      "ወደ ኦሞ ቤዛ ንዑስ አስተዳዳሪ ቦት እንኳን ደህና መጡ! 👋\n\nእዚህ ለኦሞ ቤዛ ሚኒስትሪ ሳምንታዊ ለጋሾችን ይመዘግባሉ። ለመግባት ከታች ያለውን “ስልክ ቁጥሬን አጋራ” ይጫኑ (አስተዳዳሪው የመዘገበዎት ቁጥር)።",
    share: "📱 ስልክ ቁጥሬን አጋራ",
    notOwn: "እባክዎ ከታች ባለው ቁልፍ የራስዎን ቁጥር ያጋሩ።",
    notSubAdmin: "ይህ ቁጥር እንደ ንዑስ አስተዳዳሪ አልተመዘገበም። እባክዎ የሚኒስትሪውን አስተዳዳሪ እንዲጨምርዎ ይጠይቁ፤ ከዚያ /start እንደገና ይላኩ።",
    paused: "የንዑስ አስተዳዳሪ መለያዎ ለጊዜው ቆሟል። እባክዎ የሚኒስትሪውን አስተዳዳሪ ያግኙ።",
    askPassword: "እናመሰግናለን! አሁን የይለፍ ቃልዎን ይጻፉ (ለንዑስ አስተዳዳሪ መተግበሪያው የሚጠቀሙት)። መልእክትዎን ካነበብኩ በኋላ ወዲያውኑ እሰርዘዋለሁ።",
    badPassword: "የይለፍ ቃሉ ትክክል አይደለም። እባክዎ እንደገና ይሞክሩ ወይም /cancel ይላኩ።",
    tooMany: "ብዙ ሙከራዎች ተደርገዋል። እባክዎ 15 ደቂቃ ቆይተው እንደገና ይሞክሩ።",
    signedIn: (name: string) => `ገብተዋል፣ ${name}! 🎉`,
    signedOut: "ወጥተዋል። እንደገና ለመግባት /start ይላኩ።",
    menu: { register: "➕ ለጋሽ መዝግብ", progress: "📊 ሂደቴ", donors: "📋 ለጋሾቼ" },
    progress: (registered: number, target: number, today: number) =>
      target > 0
        ? `📊 ከ${target} ለጋሾች ${registered}ዱን መዝግበዋል${today ? ` (ባለፉት 24 ሰዓታት ${today})` : ""}።\n${
            registered >= target ? "🎉 ግብዎን አሳክተዋል። እናመሰግናለን!" : `${target - registered} ይቀራሉ።`
          }`
        : `📊 ${registered} ለጋሾችን መዝግበዋል${today ? ` (ባለፉት 24 ሰዓታት ${today})` : ""}።`,
    noDonors: "እስካሁን ምንም ለጋሽ አልመዘገቡም። ለመጀመር “ለጋሽ መዝግብ” ይጫኑ።",
    donorsTitle: (shown: number, total: number) => (shown < total ? `ከ${total} ለጋሾችዎ የቅርብ ${shown}፦` : `ለጋሾችዎ (${total})፦`),
    askName: "አዲስ ለጋሽ ✍️\n\nየለጋሹ ሙሉ ስም ማን ነው?\n\n(ለማቆም በማንኛውም ጊዜ /cancel ይላኩ።)",
    badName: "እባክዎ የለጋሹን ሙሉ ስም ይጻፉ።",
    askPhone: "የለጋሹ ስልክ ቁጥር? ለምሳሌ 0911 234 567። የእውቂያ ካርዳቸውንም መላክ ይችላሉ።",
    badPhone: "ይህ የኢትዮጵያ የሞባይል ቁጥር አይደለም። እባክዎ እንደ 0911 234 567 ይጻፉ።",
    taken: "ይህ ስልክ ቁጥር አስቀድሞ እንደ ለጋሽ ተመዝግቧል። እባክዎ ሌላ ቁጥር ይጻፉ ወይም /cancel ይላኩ።",
    askAmount: (min: number) => `በየሳምንቱ ምን ያህል ብር ይሰጣሉ? ይምረጡ ወይም “ሌላ” ተጭነው ይጻፉ (ቢያንስ ${min} ብር)።`,
    other: "✏️ ሌላ",
    typeAmount: (min: number) => `ሳምንታዊ መጠኑን በብር ይጻፉ (ቢያንስ ${min})።`,
    badAmount: (min: number) => `እባክዎ ቢያንስ ${min} ብር የሆነ ቁጥር ይጻፉ።`,
    askDay: "በሳምንቱ በየትኛው ቀን እናስታውሳቸው?",
    askLang: "መልእክቶቻቸው በየትኛው ቋንቋ ይሁኑ?",
    askEmail: "የለጋሹ ኢሜይል (አማራጭ)። ማሳሰቢያዎች በራሳቸው በኢሜይል ይላካሉ። ይጻፉ ወይም “ዝለል” ይጫኑ።",
    skip: "ዝለል",
    badEmail: "ይህ ኢሜይል አይመስልም። እንደገና ይጻፉ ወይም “ዝለል” ይጫኑ።",
    confirm: (d: Required<Pick<Data, "name" | "phone" | "amount">> & Data, day: string) =>
      `እባክዎ ያረጋግጡ፦\n\n👤 ${d.name}\n📱 ${displayPhone(d.phone)}\n💛 በየሳምንቱ ${birr(d.amount)} ብር\n📅 ማሳሰቢያ በየ${day}\n🌐 ${
        d.locale === "am" ? "አማርኛ" : "English"
      }${d.email ? `\n✉️ ${d.email}` : ""}\n\nበማረጋገጥዎ ለጋሹ ሳምንታዊ ማሳሰቢያ ለመቀበል መስማማታቸውን ያረጋግጣሉ (በማንኛውም ጊዜ ማቆም ይችላሉ)።`,
    yes: "✅ አረጋግጥ",
    restart: "↺ እንደገና ጀምር",
    cancel: "✖ ሰርዝ",
    cancelled: "ተሰርዟል።",
    saved: (name: string) => `✅ ${name} ተመዝግበዋል። እናመሰግናለን!`,
    forward: (name: string) => `👇 የሚቀጥለውን መልእክት ለ${name} ያስተላልፉ (ወይም በቴሌግራም ለመላክ ቁልፉን ይጫኑ)።`,
    sendTg: "📤 በቴሌግራም ላክ",
    reminders: "ሳምንታዊ ማሳሰቢያ በቴሌግራም (Start ይጫኑ)፦",
    failed: {
      already_registered: "ይህ ስልክ ቁጥር አስቀድሞ እንደ ለጋሽ ተመዝግቧል።",
      save_failed: "ይቅርታ፣ ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
      other: "ከመረጃው አንዱ ትክክል አልነበረም። እባክዎ እንደገና ይጀምሩ።",
    },
    notSignedIn: "እባክዎ መጀመሪያ ይግቡ፦ /start ይላኩ።",
    langSet: "ቋንቋ፦ አማርኛ።",
    help: "የኦሞ ቤዛ ሚኒስትሪ ንዑስ አስተዳዳሪ ቦት።\n\n/register – ለጋሽ መመዝገብ\n/progress – ሂደትዎ\n/donors – የመዘገቧቸው ለጋሾች\n/cancel – የአሁኑን ደረጃ ለማቆም\n/language – English / አማርኛ\n/logout – ለመውጣት",
    unavailable: "ቦቱ አሁን አይሰራም። እባክዎ ቆይተው ይሞክሩ።",
  },
};

// ---- Telegram helpers ------------------------------------------------------

async function reply(chatId: number, text: string, extra: Record<string, unknown> = {}): Promise<void> {
  await subBot("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true, ...extra });
}

const inline = (rows: { text: string; data?: string; url?: string }[][]) => ({
  reply_markup: {
    inline_keyboard: rows.map((r) => r.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data }))),
  },
});
const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

const menuKeyboard = (lang: Lang) => ({
  reply_markup: {
    keyboard: [[{ text: T[lang].menu.register }], [{ text: T[lang].menu.progress }, { text: T[lang].menu.donors }]],
    resize_keyboard: true,
    is_persistent: true,
  },
});
const shareKeyboard = (lang: Lang) => ({
  reply_markup: { keyboard: [[{ text: T[lang].share, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
});
const noKeyboard = { reply_markup: { remove_keyboard: true } };

// ---- State -----------------------------------------------------------------

async function signedIn(chatId: number): Promise<Me | null> {
  return queryOne<Me>(
    `select r.id, r.name, r.target, r.status, t.lang from registrar_telegram t join registrars r on r.id = t.registrar_id
     where t.chat_id = $1`,
    [String(chatId)],
  );
}

async function getSession(chatId: number): Promise<{ step: Step; data: Data } | null> {
  const row = await queryOne<{ step: Step; data: Data; updated_at: string }>(
    "select step, data, updated_at from registrar_bot_sessions where chat_id = $1",
    [String(chatId)],
  );
  if (!row || Date.now() - new Date(row.updated_at).getTime() > 86_400_000) return null;
  return { step: row.step, data: row.data ?? {} };
}

async function setSession(chatId: number, step: Step, data: Data): Promise<void> {
  await query(
    `insert into registrar_bot_sessions (chat_id, step, data, updated_at) values ($1, $2, $3, now())
     on conflict (chat_id) do update set step = excluded.step, data = excluded.data, updated_at = now()`,
    [String(chatId), step, JSON.stringify(data)],
  );
}

async function endSession(chatId: number): Promise<void> {
  await query("delete from registrar_bot_sessions where chat_id = $1", [String(chatId)]);
}

// ---- Screens ---------------------------------------------------------------

async function progressText(me: Me): Promise<string> {
  const c = await queryOne<{ registered: number; today: number }>(
    `select count(*)::int as registered, count(*) filter (where created_at > now() - interval '24 hours')::int as today
     from donors where registered_by = $1`,
    [me.id],
  );
  return T[me.lang].progress(c?.registered ?? 0, me.target, c?.today ?? 0);
}

async function showMenu(chatId: number, me: Me, before = ""): Promise<void> {
  await reply(chatId, `${before ? `${before}\n\n` : ""}${await progressText(me)}`, menuKeyboard(me.lang));
}

async function showDonors(chatId: number, me: Me): Promise<void> {
  const rows = await query<{ name: string; phone: string; amount: number; reminder_day: number; status: string }>(
    "select name, phone, amount, reminder_day, status from donors where registered_by = $1 order by created_at desc limit 30",
    [me.id],
  );
  const total = (await queryOne<{ n: number }>("select count(*)::int as n from donors where registered_by = $1", [me.id]))?.n ?? 0;
  const t = T[me.lang];
  if (!total) return reply(chatId, t.noDonors, menuKeyboard(me.lang));
  const lines = rows.map(
    (d, i) =>
      `${i + 1}. ${d.name} · ${displayPhone(d.phone)}\n    ${birr(d.amount)} ${me.lang === "am" ? "ብር" : "birr"} · ${dayName(d.reminder_day, me.lang)}${
        d.status === "active" ? "" : ` · ${d.status}`
      }`,
  );
  await reply(chatId, `${t.donorsTitle(rows.length, total)}\n\n${lines.join("\n")}`, menuKeyboard(me.lang));
}

/** Ask the question for `step` of registering a donor (and remember it). */
async function ask(chatId: number, step: Step, data: Data, lang: Lang, giving: GivingSettings): Promise<void> {
  const t = T[lang];
  await setSession(chatId, step, data);
  const cancelRow = [{ text: t.cancel, data: "cancel" }];
  switch (step) {
    case "password":
      return reply(chatId, t.askPassword, noKeyboard);
    case "name":
      return reply(chatId, t.askName, noKeyboard);
    case "phone":
      return reply(chatId, t.askPhone);
    case "amount":
      return reply(
        chatId,
        t.askAmount(giving.minAmount),
        inline([
          ...chunk(giving.amounts.map((a) => ({ text: `${birr(a)}`, data: `amt:${a}` })), 4),
          [{ text: t.other, data: "amt:other" }, ...cancelRow],
        ]),
      );
    case "amount_custom":
      return reply(chatId, t.typeAmount(giving.minAmount));
    case "day":
      return reply(
        chatId,
        t.askDay,
        inline([...chunk([0, 1, 2, 3, 4, 5, 6].map((d) => ({ text: dayName(d, lang), data: `day:${d}` })), 4), cancelRow]),
      );
    case "lang":
      return reply(chatId, t.askLang, inline([[{ text: "English", data: "lang:en" }, { text: "አማርኛ", data: "lang:am" }], cancelRow]));
    case "email":
      return reply(chatId, t.askEmail, inline([[{ text: t.skip, data: "email:skip" }, ...cancelRow]]));
    case "confirm": {
      if (!data.name || !data.phone || !data.amount) return ask(chatId, "name", {}, lang, giving);
      const full = { ...data, name: data.name, phone: data.phone, amount: data.amount };
      return reply(
        chatId,
        t.confirm(full, dayName(data.day ?? giving.defaultDay, lang)),
        inline([[{ text: t.yes, data: "ok" }], [{ text: t.restart, data: "restart" }, ...cancelRow]]),
      );
    }
  }
}

async function finish(chatId: number, me: Me, data: Data): Promise<void> {
  const t = T[me.lang];
  await endSession(chatId);
  const res = await registerDonor({
    name: data.name,
    phone: data.phone,
    email: data.email ?? "",
    amount: data.amount,
    day: data.day,
    locale: data.locale ?? me.lang,
    source: "registrar",
    requires: "phone",
    registeredBy: me.id,
    noUpdate: true,
  });
  if (!res.ok) {
    const msg = res.error === "already_registered" || res.error === "save_failed" ? t.failed[res.error] : t.failed.other;
    return showMenu(chatId, me, `⚠️ ${msg}`);
  }
  const donor = res.donor;
  await showMenu(chatId, me, t.saved(donor.name));

  // A message for the sub-admin to forward to the donor: the thank-you (with
  // the payment link) and the donor bot for reminders on Telegram.
  const giving = await readGivingNow();
  const am = donor.locale === "am";
  const thanks = giving.welcomeEnabled ? donorMessage("welcome", donor, giving) : giveLink(giving, donor.locale, donor.amount);
  const forward = res.telegramLink ? `${thanks}\n\n${T[am ? "am" : "en"].reminders}\n${res.telegramLink}` : thanks;
  await reply(chatId, t.forward(first(donor.name)));
  await reply(chatId, forward, inline([[{ text: t.sendTg, url: `https://t.me/share/url?url=${encodeURIComponent(res.link)}&text=${encodeURIComponent(forward)}` }]]));
}

// ---- Webhook ---------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  if (!process.env.TELEGRAM_SUBADMIN_BOT_TOKEN || request.headers.get("x-telegram-bot-api-secret-token") !== subBotSecret()) {
    return new Response("forbidden", { status: 403 });
  }
  let update: { message?: TgMessage; callback_query?: TgCallback };
  try {
    update = (await request.json()) as typeof update;
  } catch {
    return ok();
  }
  if (!hasDb()) {
    const chatId = update.message?.chat.id;
    if (chatId) await reply(chatId, T.en.unavailable);
    return ok();
  }
  try {
    if (update.callback_query) await onButton(update.callback_query);
    else if (update.message && update.message.chat.type === "private" && update.message.from) await onMessage(update.message);
  } catch (err) {
    console.error("sub-admin bot:", err);
  }
  return ok();
}

/** The signed-in sub-admin for this chat; a paused one is signed out here. */
async function whoIs(chatId: number): Promise<{ me: Me | null; paused: boolean }> {
  const me = await signedIn(chatId);
  if (me && me.status !== "active") {
    await query("delete from registrar_telegram where chat_id = $1", [String(chatId)]);
    return { me: null, paused: true };
  }
  return { me, paused: false };
}

async function onMessage(msg: TgMessage): Promise<void> {
  const from = msg.from as TgUser;
  const chatId = msg.chat.id;
  const { me, paused } = await whoIs(chatId);
  const session = await getSession(chatId);
  const lang: Lang = me?.lang ?? session?.data.ui ?? (from.language_code === "am" ? "am" : "en");
  const t = T[lang];
  const giving = await readGivingNow();
  const text = (msg.text ?? "").trim();
  if (paused) {
    await endSession(chatId);
    return reply(chatId, t.paused, noKeyboard);
  }

  const command = text.startsWith("/")
    ? text.split(/\s+/)[0].toLowerCase().replace(/@\w+$/, "")
    : text === T.en.menu.register || text === T.am.menu.register
      ? "/register"
      : text === T.en.menu.progress || text === T.am.menu.progress
        ? "/progress"
        : text === T.en.menu.donors || text === T.am.menu.donors
          ? "/donors"
          : "";

  // ---- Not signed in: phone number, then password.
  if (!me) {
    if (msg.contact) {
      if (msg.contact.user_id !== from.id) return reply(chatId, t.notOwn, shareKeyboard(lang));
      const phone = normalizePhone(msg.contact.phone_number);
      const r = phone ? await queryOne<{ id: number; status: string }>("select id, status from registrars where phone = $1", [phone]) : null;
      if (!r) return reply(chatId, t.notSubAdmin, noKeyboard);
      if (r.status !== "active") return reply(chatId, t.paused, noKeyboard);
      return ask(chatId, "password", { rid: r.id, ui: lang }, lang, giving);
    }
    if (command === "/language") return chooseLanguage(chatId, lang);
    if (session?.step === "password" && session.data.rid && text && !command) {
      // Don't leave the password in the chat.
      await subBot("deleteMessage", { chat_id: chatId, message_id: msg.message_id });
      if (limited(`regbot:${chatId}`, 6, 15 * 60_000) || limited(`regbot-r:${session.data.rid}`, 8, 15 * 60_000)) {
        return reply(chatId, t.tooMany);
      }
      const r = await queryOne<{ id: number; name: string; status: string; password_hash: string }>(
        "select id, name, status, password_hash from registrars where id = $1",
        [session.data.rid],
      );
      if (!r || r.status !== "active") {
        await endSession(chatId);
        return reply(chatId, r ? t.paused : t.notSubAdmin);
      }
      if (!(await verifyPassword(text, r.password_hash))) return reply(chatId, t.badPassword);
      await endSession(chatId);
      await query(
        `insert into registrar_telegram (chat_id, registrar_id, username, lang) values ($1, $2, $3, $4)
         on conflict (chat_id) do update set registrar_id = excluded.registrar_id, username = excluded.username, lang = excluded.lang, linked_at = now()`,
        [String(chatId), r.id, from.username?.toLowerCase() ?? "", lang],
      );
      await query("update registrars set last_login = now() where id = $1", [r.id]);
      const now = await signedIn(chatId);
      if (now) await showMenu(chatId, now, `${t.signedIn(first(r.name))}\n\n${t.help}`);
      return;
    }
    if (command === "/cancel") await endSession(chatId);
    return reply(chatId, command === "/start" || command === "/cancel" || !text ? t.welcome : `${t.notSignedIn}\n\n${t.welcome}`, shareKeyboard(lang));
  }

  // ---- Signed in.
  if (command) {
    switch (command) {
      case "/register":
        return ask(chatId, "name", {}, lang, giving);
      case "/progress":
      case "/start":
        await endSession(chatId);
        return showMenu(chatId, me);
      case "/donors":
        await endSession(chatId);
        return showDonors(chatId, me);
      case "/cancel":
        await endSession(chatId);
        return showMenu(chatId, me, t.cancelled);
      case "/language":
        return chooseLanguage(chatId, lang);
      case "/logout":
        await endSession(chatId);
        await query("delete from registrar_telegram where chat_id = $1", [String(chatId)]);
        return reply(chatId, t.signedOut, noKeyboard);
      default:
        return reply(chatId, t.help, menuKeyboard(lang));
    }
  }

  // Answers to the questions of registering a donor.
  const data = session?.data ?? {};
  if (!session) return reply(chatId, t.help, menuKeyboard(lang));
  switch (session.step) {
    case "name": {
      const name = text.replace(/\s+/g, " ").trim();
      if (name.length < 2 || name.length > 80 || /[<>{}]/.test(name)) return reply(chatId, t.badName);
      return ask(chatId, "phone", { ...data, name }, lang, giving);
    }
    case "phone": {
      const phone = normalizePhone(msg.contact?.phone_number ?? text);
      if (!phone) return reply(chatId, t.badPhone);
      if (await queryOne("select 1 from donors where phone = $1", [phone])) return reply(chatId, t.taken);
      return ask(chatId, "amount", { ...data, phone }, lang, giving);
    }
    case "amount_custom": {
      const amount = Math.round(Number(text.replace(/[^\d.]/g, "")));
      if (!(amount >= giving.minAmount && amount <= 1_000_000)) return reply(chatId, t.badAmount(giving.minAmount));
      return ask(chatId, "day", { ...data, amount }, lang, giving);
    }
    case "email": {
      const email = text.toLowerCase();
      if (!isEmail(email) || email.length > 200) return reply(chatId, t.badEmail);
      return ask(chatId, "confirm", { ...data, email }, lang, giving);
    }
    default:
      // A button question: ask it again.
      return ask(chatId, session.step, data, lang, giving);
  }
}

async function chooseLanguage(chatId: number, lang: Lang): Promise<void> {
  await reply(chatId, lang === "am" ? "ቋንቋ ይምረጡ፦" : "Choose a language:", inline([[{ text: "English", data: "ui:en" }, { text: "አማርኛ", data: "ui:am" }]]));
}

async function onButton(cb: TgCallback): Promise<void> {
  await subBot("answerCallbackQuery", { callback_query_id: cb.id });
  const chatId = cb.message?.chat.id;
  if (!chatId || cb.message?.chat.type !== "private") return;
  // Remove the buttons that were just used.
  await subBot("editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });

  const { me, paused } = await whoIs(chatId);
  const session = await getSession(chatId);
  const [key, value = ""] = (cb.data ?? "").split(":");
  const giving = await readGivingNow();

  if (key === "ui" && (value === "en" || value === "am")) {
    if (me) {
      await query("update registrar_telegram set lang = $1 where chat_id = $2", [value, String(chatId)]);
      return showMenu(chatId, { ...me, lang: value }, T[value].langSet);
    }
    if (session) await setSession(chatId, session.step, { ...session.data, ui: value });
    else await setSession(chatId, "password", { ui: value });
    return reply(chatId, `${T[value].langSet}\n\n${T[value].welcome}`, shareKeyboard(value));
  }

  const lang: Lang = me?.lang ?? session?.data.ui ?? (cb.from.language_code === "am" ? "am" : "en");
  if (paused) return reply(chatId, T[lang].paused, noKeyboard);
  if (!me) return reply(chatId, T[lang].notSignedIn, shareKeyboard(lang));
  if (key === "cancel") {
    await endSession(chatId);
    return showMenu(chatId, me, T[lang].cancelled);
  }
  if (!session) return showMenu(chatId, me);
  const data = session.data;

  if (key === "amt" && session.step === "amount") {
    if (value === "other") return ask(chatId, "amount_custom", data, lang, giving);
    const amount = Number(value);
    if (giving.amounts.includes(amount)) return ask(chatId, "day", { ...data, amount }, lang, giving);
  }
  if (key === "day" && session.step === "day") {
    const day = Number(value);
    if (day >= 0 && day <= 6) return ask(chatId, "lang", { ...data, day }, lang, giving);
  }
  if (key === "lang" && session.step === "lang" && (value === "en" || value === "am")) {
    return ask(chatId, "email", { ...data, locale: value }, lang, giving);
  }
  if (key === "email" && value === "skip" && session.step === "email") return ask(chatId, "confirm", { ...data, email: "" }, lang, giving);
  if (key === "restart") return ask(chatId, "name", {}, lang, giving);
  if (key === "ok" && session.step === "confirm") return finish(chatId, me, data);
  // A stale button: ask the current question again.
  return ask(chatId, session.step, data, lang, giving);
}
