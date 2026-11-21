import { hasDb, query, queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { readGivingNow } from "@/lib/data/giving";
import { MONTH_DAYS, dayName, displayPhone, isEmail, normalizePhone, periodWords, scheduleDay, type GivingSettings } from "@/lib/giving";
import { registerDonor } from "@/lib/donors";
import { limited } from "@/lib/ratelimit";
import { extendTarget, MAX_SELF_EXTEND } from "@/lib/registrars";
import { donorMessage, giveLink } from "@/lib/reminders";
import { subBot, subBotSecret } from "@/lib/telegram-subadmin";
import { ADMIN_HELP, adminAnswer, adminButton, adminCommandFor, adminKeyboard, adminTargetButton, showOverview, showRemind, showSubs, startFind } from "./admin";
import {
  birr,
  chunk,
  endSession,
  first,
  getSession,
  inline,
  noKeyboard,
  reply,
  setSession,
  type Actor,
  type Data,
  type Lang,
  type Step,
  type TgCallback,
  type TgMessage,
  type TgUser,
} from "./core";

// POST /api/telegram/subadmin — the team Telegram bot (TELEGRAM_SUBADMIN_BOT_TOKEN),
// for the ministry's admins and sub-admins, e.g. on an iPhone:
//   • sub-admins sign in once by sharing their phone number and typing their
//     password, then register donors step by step (name → phone → monthly or
//     weekly → amount → day → language → email → confirm), see their progress
//     and donors, and raise their own target once it is reached;
//   • admins sign in with their dashboard email and password and get the admin
//     tools (admin.ts): overview, register and find donors, record payments,
//     pause / stop / remind a donor, send today's reminders, manage sub-admins.
// After each registration the bot gives a message to forward to the donor.
// Pausing a sub-admin, changing a password or removing someone signs them out
// here too; an admin's sign-in lasts 30 days.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ADMIN_DAYS = 30;

/** The command menu in an admin's chat (everyone else sees the sub-admin commands). */
const ADMIN_COMMANDS = [
  { command: "overview", description: "Numbers at a glance" },
  { command: "register", description: "Register a donor" },
  { command: "find", description: "Find a donor" },
  { command: "subadmins", description: "Sub-admins and targets" },
  { command: "remind", description: "Send today's reminders" },
  { command: "cancel", description: "Stop the current step" },
  { command: "logout", description: "Sign out" },
];

const T = {
  en: {
    welcome:
      "Welcome to the Omo Beeza team bot! 👋\n\nSub-admins: tap “Share my phone number” below (the number the admin registered you with).\nAdmins: tap “Sign in as admin”.",
    share: "📱 Share my phone number",
    adminSignIn: "🔐 Sign in as admin",
    notOwn: "Please share your own number with the button below.",
    notSubAdmin: "This number isn't registered as a sub-admin. Please ask the ministry's admin to add you, then send /start again.",
    paused: "Your sub-admin account is paused. Please contact the ministry's admin.",
    askPassword: "Thank you! Now type your password (the same one as for the app). I'll delete your message right after reading it.",
    askAdminEmail: "Admin sign-in 🔐\n\nType the email you use for the website dashboard.",
    askAdminPassword: "Now type your dashboard password. I'll delete your message right after reading it.",
    badLogin: "That email and password don't match. Please try again, or send /cancel.",
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
    extendOffer: "You've reached your target 🎉 Would you like to register more donors? Choose how many to add to your target.",
    extendOther: "✏️ Other",
    typeExtend: `How many more donors will you register? Type a number (1–${MAX_SELF_EXTEND}).`,
    badExtend: `Please type a number from 1 to ${MAX_SELF_EXTEND}.`,
    extended: (target: number) => `✅ Your new target is ${target} donors. Thank you!`,
    notReached: "You can add more once you've reached your current target.",
    noDonors: "You haven't registered any donors yet. Tap “Register a donor” to start.",
    donorsTitle: (shown: number, total: number) => (shown < total ? `Your latest ${shown} of ${total} donors:` : `Your donors (${total}):`),
    askName: "New donor ✍️\n\nWhat is the donor's full name?\n\n(Send /cancel at any time to stop.)",
    badName: "Please type the donor's full name (2–80 letters).",
    askPhone: "The donor's phone number? For example 0911 234 567. You can also send their contact card.",
    badPhone: "That isn't an Ethiopian mobile number. Please type it like 0911 234 567.",
    taken: "This phone number is already registered as a donor. Please type a different number, or /cancel.",
    askFreq: "Will they give every month or every week?",
    monthly: "📅 Monthly",
    weekly: "🗓 Weekly",
    askAmount: (min: number, every: string) => `How much will they give ${every} (birr)? Choose, or tap “Other” to type an amount (at least ${min} birr).`,
    other: "✏️ Other",
    typeAmount: (min: number) => `Type the amount in birr (at least ${min}).`,
    badAmount: (min: number) => `Please type a number of at least ${min} birr.`,
    askDay: "Which day of the week should we remind them?",
    askMonthDay: "Which day of the month should we remind them?",
    askLang: "Which language for their messages?",
    askEmail: "The donor's email address (optional). Reminders are emailed automatically. Type it, or tap “Skip”.",
    skip: "Skip",
    badEmail: "That doesn't look like an email address. Type it again, or tap “Skip”.",
    confirm: (d: Required<Pick<Data, "name" | "phone" | "amount">> & Data, day: string) =>
      `Please check:\n\n👤 ${d.name}\n📱 ${displayPhone(d.phone)}\n💛 ${birr(d.amount)} birr ${periodWords(d.frequency ?? "weekly", "en").every}\n📅 Reminder every ${day}\n🌐 ${
        d.locale === "am" ? "Amharic" : "English"
      }${d.email ? `\n✉️ ${d.email}` : ""}\n\nBy confirming, you confirm that the donor agreed to receive reminders (they can stop at any time).`,
    yes: "✅ Confirm",
    restart: "↺ Start over",
    cancel: "✖ Cancel",
    cancelled: "Cancelled.",
    saved: (name: string) => `✅ ${name} is registered. Thank you!`,
    forward: (name: string) => `👇 Forward the next message to ${name} (or tap the button to send it on Telegram).`,
    sendTg: "📤 Send on Telegram",
    reminders: "Reminders on Telegram (tap Start):",
    failed: {
      already_registered: "This phone number is already registered as a donor.",
      save_failed: "Sorry, saving failed. Please try again.",
      other: "Something in the details wasn't right. Please start again.",
    },
    notSignedIn: "Please sign in first: send /start.",
    langSet: "Language: English.",
    help: "Sub-admin bot for Omo Beeza Ministry.\n\n/register – register a donor\n/progress – your progress\n/donors – the donors you registered\n/extend – register more than your target\n/cancel – stop the current step\n/language – English / አማርኛ\n/logout – sign out",
    unavailable: "The bot isn't available right now. Please try again later.",
  },
  am: {
    welcome:
      "ወደ ኦሞ ቤዛ የቡድን ቦት እንኳን ደህና መጡ! 👋\n\nንዑስ አስተዳዳሪዎች፦ ከታች ያለውን “ስልክ ቁጥሬን አጋራ” ይጫኑ (አስተዳዳሪው የመዘገበዎት ቁጥር)።\nአስተዳዳሪዎች፦ “Sign in as admin” ይጫኑ።",
    share: "📱 ስልክ ቁጥሬን አጋራ",
    adminSignIn: "🔐 Sign in as admin",
    notOwn: "እባክዎ ከታች ባለው ቁልፍ የራስዎን ቁጥር ያጋሩ።",
    notSubAdmin: "ይህ ቁጥር እንደ ንዑስ አስተዳዳሪ አልተመዘገበም። እባክዎ የሚኒስትሪውን አስተዳዳሪ እንዲጨምርዎ ይጠይቁ፤ ከዚያ /start እንደገና ይላኩ።",
    paused: "የንዑስ አስተዳዳሪ መለያዎ ለጊዜው ቆሟል። እባክዎ የሚኒስትሪውን አስተዳዳሪ ያግኙ።",
    askPassword: "እናመሰግናለን! አሁን የይለፍ ቃልዎን ይጻፉ (ለመተግበሪያው የሚጠቀሙት)። መልእክትዎን ካነበብኩ በኋላ ወዲያውኑ እሰርዘዋለሁ።",
    askAdminEmail: "Admin sign-in 🔐\n\nType the email you use for the website dashboard.",
    askAdminPassword: "Now type your dashboard password. I'll delete your message right after reading it.",
    badLogin: "That email and password don't match. Please try again, or send /cancel.",
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
    extendOffer: "ግብዎን አሳክተዋል 🎉 ተጨማሪ ለጋሾችን መመዝገብ ይፈልጋሉ? በግብዎ ላይ ምን ያህል እንደሚጨምሩ ይምረጡ።",
    extendOther: "✏️ ሌላ",
    typeExtend: `ስንት ተጨማሪ ለጋሾችን ይመዘግባሉ? ቁጥር ይጻፉ (1–${MAX_SELF_EXTEND})።`,
    badExtend: `እባክዎ ከ1 እስከ ${MAX_SELF_EXTEND} ያለ ቁጥር ይጻፉ።`,
    extended: (target: number) => `✅ አዲሱ ግብዎ ${target} ለጋሾች ነው። እናመሰግናለን!`,
    notReached: "አሁን ያለውን ግብዎን ካሳኩ በኋላ መጨመር ይችላሉ።",
    noDonors: "እስካሁን ምንም ለጋሽ አልመዘገቡም። ለመጀመር “ለጋሽ መዝግብ” ይጫኑ።",
    donorsTitle: (shown: number, total: number) => (shown < total ? `ከ${total} ለጋሾችዎ የቅርብ ${shown}፦` : `ለጋሾችዎ (${total})፦`),
    askName: "አዲስ ለጋሽ ✍️\n\nየለጋሹ ሙሉ ስም ማን ነው?\n\n(ለማቆም በማንኛውም ጊዜ /cancel ይላኩ።)",
    badName: "እባክዎ የለጋሹን ሙሉ ስም ይጻፉ።",
    askPhone: "የለጋሹ ስልክ ቁጥር? ለምሳሌ 0911 234 567። የእውቂያ ካርዳቸውንም መላክ ይችላሉ።",
    badPhone: "ይህ የኢትዮጵያ የሞባይል ቁጥር አይደለም። እባክዎ እንደ 0911 234 567 ይጻፉ።",
    taken: "ይህ ስልክ ቁጥር አስቀድሞ እንደ ለጋሽ ተመዝግቧል። እባክዎ ሌላ ቁጥር ይጻፉ ወይም /cancel ይላኩ።",
    askFreq: "በየወሩ ወይስ በየሳምንቱ ይሰጣሉ?",
    monthly: "📅 በየወሩ",
    weekly: "🗓 በየሳምንቱ",
    askAmount: (min: number, every: string) => `${every} ምን ያህል ብር ይሰጣሉ? ይምረጡ ወይም “ሌላ” ተጭነው ይጻፉ (ቢያንስ ${min} ብር)።`,
    other: "✏️ ሌላ",
    typeAmount: (min: number) => `መጠኑን በብር ይጻፉ (ቢያንስ ${min})።`,
    badAmount: (min: number) => `እባክዎ ቢያንስ ${min} ብር የሆነ ቁጥር ይጻፉ።`,
    askDay: "በሳምንቱ በየትኛው ቀን እናስታውሳቸው?",
    askMonthDay: "በወሩ በየትኛው ቀን እናስታውሳቸው?",
    askLang: "መልእክቶቻቸው በየትኛው ቋንቋ ይሁኑ?",
    askEmail: "የለጋሹ ኢሜይል (አማራጭ)። ማሳሰቢያዎች በራሳቸው በኢሜይል ይላካሉ። ይጻፉ ወይም “ዝለል” ይጫኑ።",
    skip: "ዝለል",
    badEmail: "ይህ ኢሜይል አይመስልም። እንደገና ይጻፉ ወይም “ዝለል” ይጫኑ።",
    confirm: (d: Required<Pick<Data, "name" | "phone" | "amount">> & Data, day: string) =>
      `እባክዎ ያረጋግጡ፦\n\n👤 ${d.name}\n📱 ${displayPhone(d.phone)}\n💛 ${periodWords(d.frequency ?? "weekly", "am").every} ${birr(d.amount)} ብር\n📅 ማሳሰቢያ በየ${day}\n🌐 ${
        d.locale === "am" ? "አማርኛ" : "English"
      }${d.email ? `\n✉️ ${d.email}` : ""}\n\nበማረጋገጥዎ ለጋሹ ማሳሰቢያ ለመቀበል መስማማታቸውን ያረጋግጣሉ (በማንኛውም ጊዜ ማቆም ይችላሉ)።`,
    yes: "✅ አረጋግጥ",
    restart: "↺ እንደገና ጀምር",
    cancel: "✖ ሰርዝ",
    cancelled: "ተሰርዟል።",
    saved: (name: string) => `✅ ${name} ተመዝግበዋል። እናመሰግናለን!`,
    forward: (name: string) => `👇 የሚቀጥለውን መልእክት ለ${name} ያስተላልፉ (ወይም በቴሌግራም ለመላክ ቁልፉን ይጫኑ)።`,
    sendTg: "📤 በቴሌግራም ላክ",
    reminders: "ማሳሰቢያ በቴሌግራም (Start ይጫኑ)፦",
    failed: {
      already_registered: "ይህ ስልክ ቁጥር አስቀድሞ እንደ ለጋሽ ተመዝግቧል።",
      save_failed: "ይቅርታ፣ ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
      other: "ከመረጃው አንዱ ትክክል አልነበረም። እባክዎ እንደገና ይጀምሩ።",
    },
    notSignedIn: "እባክዎ መጀመሪያ ይግቡ፦ /start ይላኩ።",
    langSet: "ቋንቋ፦ አማርኛ።",
    help: "የኦሞ ቤዛ ሚኒስትሪ ንዑስ አስተዳዳሪ ቦት።\n\n/register – ለጋሽ መመዝገብ\n/progress – ሂደትዎ\n/donors – የመዘገቧቸው ለጋሾች\n/extend – ከግብዎ በላይ ለመመዝገብ\n/cancel – የአሁኑን ደረጃ ለማቆም\n/language – English / አማርኛ\n/logout – ለመውጣት",
    unavailable: "ቦቱ አሁን አይሰራም። እባክዎ ቆይተው ይሞክሩ።",
  },
};

const ok = () => new Response("ok");

const subKeyboard = (lang: Lang) => ({
  reply_markup: {
    keyboard: [[{ text: T[lang].menu.register }], [{ text: T[lang].menu.progress }, { text: T[lang].menu.donors }]],
    resize_keyboard: true,
    is_persistent: true,
  },
});
const signInKeyboard = (lang: Lang) => ({
  reply_markup: {
    keyboard: [[{ text: T[lang].share, request_contact: true }], [{ text: T[lang].adminSignIn }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
});

// ---- Who is signed in --------------------------------------------------------

/** The admin or sub-admin signed in to this chat. A paused sub-admin is signed out here. */
async function whoIs(chatId: number): Promise<{ actor: Actor | null; paused: boolean }> {
  const admin = await queryOne<{ id: number; name: string; lang: Lang; linked_at: string }>(
    `select u.id, u.name, t.lang, t.linked_at from admin_telegram t join users u on u.id = t.user_id where t.chat_id = $1`,
    [String(chatId)],
  );
  if (admin) {
    if (Date.now() - new Date(admin.linked_at).getTime() < ADMIN_DAYS * 86_400_000) {
      return { actor: { role: "admin", id: admin.id, name: admin.name, lang: admin.lang === "am" ? "am" : "en" }, paused: false };
    }
    await query("delete from admin_telegram where chat_id = $1", [String(chatId)]);
  }
  const sub = await queryOne<{ id: number; name: string; target: number; status: string; lang: Lang }>(
    `select r.id, r.name, r.target, r.status, t.lang from registrar_telegram t join registrars r on r.id = t.registrar_id where t.chat_id = $1`,
    [String(chatId)],
  );
  if (!sub) return { actor: null, paused: false };
  if (sub.status !== "active") {
    await query("delete from registrar_telegram where chat_id = $1", [String(chatId)]);
    return { actor: null, paused: true };
  }
  return { actor: { role: "sub", id: sub.id, name: sub.name, target: sub.target, lang: sub.lang === "am" ? "am" : "en" }, paused: false };
}

/** Signs this chat in as one person (and out of anyone else). */
async function signIn(chatId: number, role: "sub" | "admin", id: number, from: TgUser, lang: Lang): Promise<void> {
  await query("delete from admin_telegram where chat_id = $1", [String(chatId)]);
  await query("delete from registrar_telegram where chat_id = $1", [String(chatId)]);
  if (role === "admin") {
    await query("insert into admin_telegram (chat_id, user_id, username, lang) values ($1, $2, $3, $4)", [
      String(chatId),
      id,
      from.username?.toLowerCase() ?? "",
      lang,
    ]);
    await query("update users set last_login = now() where id = $1", [id]);
    await subBot("setMyCommands", { commands: ADMIN_COMMANDS, scope: { type: "chat", chat_id: chatId } });
  } else {
    await subBot("deleteMyCommands", { scope: { type: "chat", chat_id: chatId } });
    await query("insert into registrar_telegram (chat_id, registrar_id, username, lang) values ($1, $2, $3, $4)", [
      String(chatId),
      id,
      from.username?.toLowerCase() ?? "",
      lang,
    ]);
    await query("update registrars set last_login = now() where id = $1", [id]);
  }
}

// ---- Home screens ------------------------------------------------------------

async function subHome(chatId: number, actor: Extract<Actor, { role: "sub" }>, before = ""): Promise<void> {
  const r = await queryOne<{ target: number; registered: number; today: number }>(
    `select r.target, (select count(*)::int from donors d where d.registered_by = r.id and d.deleted_at is null) as registered,
            (select count(*)::int from donors d where d.registered_by = r.id and d.deleted_at is null and d.created_at > now() - interval '24 hours') as today
     from registrars r where r.id = $1`,
    [actor.id],
  );
  const target = r?.target ?? actor.target;
  const registered = r?.registered ?? 0;
  const t = T[actor.lang];
  await reply(chatId, `${before ? `${before}\n\n` : ""}${t.progress(registered, target, r?.today ?? 0)}`, subKeyboard(actor.lang));
  if (target > 0 && registered >= target) {
    await reply(chatId, t.extendOffer, inline([[{ text: "+5", data: "ext:5" }, { text: "+10", data: "ext:10" }, { text: t.extendOther, data: "ext:other" }]]));
  }
}

/** The signed-in person's main screen: progress (sub-admin) or the overview (admin). */
async function home(chatId: number, actor: Actor, before = ""): Promise<void> {
  if (actor.role === "admin") return showOverview(chatId, before);
  return subHome(chatId, actor, before);
}

async function showDonors(chatId: number, actor: Extract<Actor, { role: "sub" }>): Promise<void> {
  const rows = await query<{ name: string; phone: string; amount: number; reminder_day: number; frequency: string; month_day: number; status: string }>(
    "select name, phone, amount, reminder_day, frequency, month_day, status from donors where registered_by = $1 and deleted_at is null order by created_at desc limit 30",
    [actor.id],
  );
  const total = (await queryOne<{ n: number }>("select count(*)::int as n from donors where registered_by = $1 and deleted_at is null", [actor.id]))?.n ?? 0;
  const t = T[actor.lang];
  if (!total) return reply(chatId, t.noDonors, subKeyboard(actor.lang));
  const lines = rows.map(
    (d, i) =>
      `${i + 1}. ${d.name} · ${displayPhone(d.phone)}\n    ${birr(d.amount)} ${actor.lang === "am" ? "ብር" : "birr"} · ${periodWords(d.frequency, actor.lang).every} · ${scheduleDay(
        d.frequency,
        d.reminder_day,
        d.month_day,
        actor.lang,
      )}${d.status === "active" ? "" : ` · ${d.status}`}`,
  );
  await reply(chatId, `${t.donorsTitle(rows.length, total)}\n\n${lines.join("\n")}`, subKeyboard(actor.lang));
}

// ---- Registering a donor (sub-admins and admins) ---------------------------------

/** Ask the question for `step` (and remember that we're waiting for it). */
async function ask(chatId: number, step: Step, data: Data, lang: Lang, giving: GivingSettings): Promise<void> {
  const t = T[lang];
  await setSession(chatId, step, data);
  const cancelRow = [{ text: t.cancel, data: "cancel" }];
  switch (step) {
    case "password":
      return reply(chatId, t.askPassword, noKeyboard);
    case "a_email":
      return reply(chatId, t.askAdminEmail, noKeyboard);
    case "a_password":
      return reply(chatId, t.askAdminPassword);
    case "name":
      return reply(chatId, t.askName, noKeyboard);
    case "phone":
      return reply(chatId, t.askPhone);
    case "freq":
      return reply(chatId, t.askFreq, inline([[{ text: t.monthly, data: "freq:monthly" }, { text: t.weekly, data: "freq:weekly" }], cancelRow]));
    case "amount":
      return reply(
        chatId,
        t.askAmount(giving.minAmount, periodWords(data.frequency ?? "weekly", lang).every),
        inline([...chunk(giving.amounts.map((a) => ({ text: `${birr(a)}`, data: `amt:${a}` })), 4), [{ text: t.other, data: "amt:other" }, ...cancelRow]]),
      );
    case "amount_custom":
      return reply(chatId, t.typeAmount(giving.minAmount));
    case "day":
      return reply(chatId, t.askDay, inline([...chunk([0, 1, 2, 3, 4, 5, 6].map((d) => ({ text: dayName(d, lang), data: `day:${d}` })), 4), cancelRow]));
    case "mday":
      return reply(chatId, t.askMonthDay, inline([...chunk(MONTH_DAYS.map((d) => ({ text: String(d), data: `mday:${d}` })), 7), cancelRow]));
    case "extend":
      return reply(chatId, t.typeExtend);
    case "lang":
      return reply(chatId, t.askLang, inline([[{ text: "English", data: "lang:en" }, { text: "አማርኛ", data: "lang:am" }], cancelRow]));
    case "email":
      return reply(chatId, t.askEmail, inline([[{ text: t.skip, data: "email:skip" }, ...cancelRow]]));
    case "confirm": {
      if (!data.name || !data.phone || !data.amount) return ask(chatId, "name", {}, lang, giving);
      const full = { ...data, name: data.name, phone: data.phone, amount: data.amount };
      return reply(
        chatId,
        t.confirm(full, scheduleDay(data.frequency ?? "weekly", data.day ?? giving.defaultDay, data.monthDay ?? giving.defaultMonthDay, lang)),
        inline([[{ text: t.yes, data: "ok" }], [{ text: t.restart, data: "restart" }, ...cancelRow]]),
      );
    }
    default:
      return;
  }
}

async function finish(chatId: number, actor: Actor, data: Data): Promise<void> {
  const t = T[actor.lang];
  await endSession(chatId);
  const res = await registerDonor({
    name: data.name,
    phone: data.phone,
    email: data.email ?? "",
    amount: data.amount,
    frequency: data.frequency ?? "weekly",
    day: data.day,
    monthDay: data.monthDay,
    locale: data.locale ?? actor.lang,
    source: actor.role === "sub" ? "registrar" : "admin",
    requires: "phone",
    registeredBy: actor.role === "sub" ? actor.id : undefined,
    noUpdate: true,
  });
  if (!res.ok) {
    const msg = res.error === "already_registered" || res.error === "save_failed" ? t.failed[res.error] : t.failed.other;
    return home(chatId, actor, `⚠️ ${msg}`);
  }
  const donor = res.donor;
  await home(chatId, actor, t.saved(donor.name));

  // A message to forward to the donor: the thank-you (with the payment link)
  // and the donor bot for reminders on Telegram.
  const giving = await readGivingNow();
  const am = donor.locale === "am";
  const thanks = giving.welcomeEnabled ? donorMessage("welcome", donor, giving) : giveLink(giving, donor.locale, donor.amount);
  const forward = res.telegramLink ? `${thanks}\n\n${T[am ? "am" : "en"].reminders}\n${res.telegramLink}` : thanks;
  await reply(chatId, t.forward(first(donor.name)));
  await reply(chatId, forward, inline([[{ text: t.sendTg, url: `https://t.me/share/url?url=${encodeURIComponent(res.link)}&text=${encodeURIComponent(forward)}` }]]));
}

/** A typed answer while registering a donor (both roles). Returns false when it isn't one. */
async function donorAnswer(chatId: number, actor: Actor, step: Step, data: Data, text: string, msg: TgMessage, giving: GivingSettings): Promise<boolean> {
  const lang = actor.lang;
  const t = T[lang];
  switch (step) {
    case "name": {
      const name = text.replace(/\s+/g, " ").trim();
      if (name.length < 2 || name.length > 80 || /[<>{}]/.test(name)) await reply(chatId, t.badName);
      else await ask(chatId, "phone", { ...data, name }, lang, giving);
      return true;
    }
    case "phone": {
      const phone = normalizePhone(msg.contact?.phone_number ?? text);
      if (!phone) await reply(chatId, t.badPhone);
      else if (await queryOne("select 1 from donors where phone = $1 and deleted_at is null", [phone])) await reply(chatId, t.taken);
      else await ask(chatId, "freq", { ...data, phone }, lang, giving);
      return true;
    }
    case "amount_custom": {
      const amount = Math.round(Number(text.replace(/[^\d.]/g, "")));
      if (!(amount >= giving.minAmount && amount <= 1_000_000)) await reply(chatId, t.badAmount(giving.minAmount));
      else await ask(chatId, data.frequency === "monthly" ? "mday" : "day", { ...data, amount }, lang, giving);
      return true;
    }
    case "email": {
      const email = text.toLowerCase();
      if (!isEmail(email) || email.length > 200) await reply(chatId, t.badEmail);
      else await ask(chatId, "confirm", { ...data, email }, lang, giving);
      return true;
    }
    case "freq":
    case "amount":
    case "day":
    case "mday":
    case "lang":
    case "confirm":
      // A button question: ask it again.
      await ask(chatId, step, data, lang, giving);
      return true;
    default:
      return false;
  }
}

// ---- Webhook -------------------------------------------------------------------

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
    console.error("team bot:", err);
  }
  return ok();
}

async function onMessage(msg: TgMessage): Promise<void> {
  const from = msg.from as TgUser;
  const chatId = msg.chat.id;
  const { actor, paused } = await whoIs(chatId);
  const session = await getSession(chatId);
  const lang: Lang = actor?.lang ?? session?.data.ui ?? (from.language_code === "am" ? "am" : "en");
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
          : text === T.en.adminSignIn
            ? "/admin"
            : adminCommandFor(text);

  // ---- Not signed in.
  if (!actor) {
    // Sub-admin: their phone number, then their password.
    if (msg.contact) {
      if (msg.contact.user_id !== from.id) return reply(chatId, t.notOwn, signInKeyboard(lang));
      const phone = normalizePhone(msg.contact.phone_number);
      const r = phone ? await queryOne<{ id: number; status: string }>("select id, status from registrars where phone = $1", [phone]) : null;
      if (!r) return reply(chatId, t.notSubAdmin, signInKeyboard(lang));
      if (r.status !== "active") return reply(chatId, t.paused, noKeyboard);
      return ask(chatId, "password", { rid: r.id, ui: lang }, lang, giving);
    }
    if (command === "/language") return chooseLanguage(chatId, lang);
    if (command === "/admin") return ask(chatId, "a_email", { ui: lang }, lang, giving);

    // Admin: email, then password.
    if (session?.step === "a_email" && text && !command) {
      const email = text.toLowerCase().trim();
      const user = isEmail(email) ? await queryOne<{ id: number }>("select id from users where lower(email) = $1", [email]) : null;
      // Same question either way, so emails can't be discovered.
      return ask(chatId, "a_password", { uid: user?.id ?? 0, ui: lang }, lang, giving);
    }
    if (session?.step === "a_password" && text && !command) {
      await subBot("deleteMessage", { chat_id: chatId, message_id: msg.message_id });
      if (limited(`teambot:${chatId}`, 6, 15 * 60_000) || limited(`teambot-u:${session.data.uid}`, 8, 15 * 60_000)) return reply(chatId, t.tooMany);
      const user = session.data.uid
        ? await queryOne<{ id: number; name: string; password_hash: string }>("select id, name, password_hash from users where id = $1", [session.data.uid])
        : null;
      if (!user || !(await verifyPassword(text, user.password_hash))) {
        await setSession(chatId, "a_email", { ui: lang });
        return reply(chatId, `${t.badLogin}\n\n${t.askAdminEmail}`);
      }
      await endSession(chatId);
      await signIn(chatId, "admin", user.id, from, lang);
      return showOverview(chatId, `${t.signedIn(first(user.name))}\n\n${ADMIN_HELP}`);
    }

    // Sub-admin password.
    if (session?.step === "password" && session.data.rid && text && !command) {
      // Don't leave the password in the chat.
      await subBot("deleteMessage", { chat_id: chatId, message_id: msg.message_id });
      if (limited(`regbot:${chatId}`, 6, 15 * 60_000) || limited(`regbot-r:${session.data.rid}`, 8, 15 * 60_000)) return reply(chatId, t.tooMany);
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
      await signIn(chatId, "sub", r.id, from, lang);
      const now = await whoIs(chatId);
      if (now.actor) await home(chatId, now.actor, `${t.signedIn(first(r.name))}\n\n${t.help}`);
      return;
    }
    if (command === "/cancel") await endSession(chatId);
    return reply(chatId, command === "/start" || command === "/cancel" || !text ? t.welcome : `${t.notSignedIn}\n\n${t.welcome}`, signInKeyboard(lang));
  }

  // ---- Signed in.
  if (command) {
    switch (command) {
      case "/register":
        return ask(chatId, "name", {}, lang, giving);
      case "/start":
      case "/progress":
      case "/overview":
        await endSession(chatId);
        return home(chatId, actor);
      case "/cancel":
        await endSession(chatId);
        return home(chatId, actor, t.cancelled);
      case "/language":
        return chooseLanguage(chatId, lang);
      case "/logout":
        await endSession(chatId);
        await query(actor.role === "admin" ? "delete from admin_telegram where chat_id = $1" : "delete from registrar_telegram where chat_id = $1", [String(chatId)]);
        if (actor.role === "admin") await subBot("deleteMyCommands", { scope: { type: "chat", chat_id: chatId } });
        return reply(chatId, t.signedOut, noKeyboard);
    }
    if (actor.role === "sub") {
      switch (command) {
        case "/extend":
          return ask(chatId, "extend", {}, lang, giving);
        case "/donors":
          await endSession(chatId);
          return showDonors(chatId, actor);
        default:
          return reply(chatId, t.help, subKeyboard(lang));
      }
    }
    switch (command) {
      case "/find":
        return startFind(chatId);
      case "/subadmins":
        await endSession(chatId);
        return showSubs(chatId);
      case "/remind":
        await endSession(chatId);
        return showRemind(chatId);
      default:
        return reply(chatId, ADMIN_HELP, adminKeyboard);
    }
  }

  if (!session) return actor.role === "admin" ? reply(chatId, ADMIN_HELP, adminKeyboard) : reply(chatId, t.help, subKeyboard(lang));
  if (await donorAnswer(chatId, actor, session.step, session.data, text, msg, giving)) return;
  if (actor.role === "sub" && session.step === "extend") {
    const n = Math.round(Number(text.replace(/[^\d]/g, "")));
    if (!(n >= 1 && n <= MAX_SELF_EXTEND)) return reply(chatId, t.badExtend);
    await endSession(chatId);
    return extend(chatId, actor, n);
  }
  if (actor.role === "admin" && (await adminAnswer(chatId, actor, session.step, session.data, text, msg.message_id))) return;
  await endSession(chatId);
  return home(chatId, actor);
}

async function extend(chatId: number, actor: Extract<Actor, { role: "sub" }>, n: number): Promise<void> {
  const res = await extendTarget(actor.id, n);
  if (res.ok) return subHome(chatId, { ...actor, target: res.target }, T[actor.lang].extended(res.target));
  return subHome(chatId, actor, res.error === "target_not_reached" ? T[actor.lang].notReached : T[actor.lang].badExtend);
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

  const { actor, paused } = await whoIs(chatId);
  const session = await getSession(chatId);
  const [key, ...parts] = (cb.data ?? "").split(":");
  const value = parts[0] ?? "";
  const giving = await readGivingNow();

  if (key === "ui" && (value === "en" || value === "am")) {
    if (actor) {
      await query(actor.role === "admin" ? "update admin_telegram set lang = $1 where chat_id = $2" : "update registrar_telegram set lang = $1 where chat_id = $2", [
        value,
        String(chatId),
      ]);
      return home(chatId, { ...actor, lang: value }, T[value].langSet);
    }
    await setSession(chatId, session?.step ?? "password", { ...(session?.data ?? {}), ui: value });
    return reply(chatId, `${T[value].langSet}\n\n${T[value].welcome}`, signInKeyboard(value));
  }

  const lang: Lang = actor?.lang ?? session?.data.ui ?? (cb.from.language_code === "am" ? "am" : "en");
  if (paused) return reply(chatId, T[lang].paused, noKeyboard);
  if (!actor) return reply(chatId, T[lang].notSignedIn, signInKeyboard(lang));
  if (key === "cancel") {
    await endSession(chatId);
    return home(chatId, actor, T[lang].cancelled);
  }
  if (actor.role === "sub" && key === "ext") {
    if (value === "other") return ask(chatId, "extend", {}, lang, giving);
    return extend(chatId, actor, Number(value));
  }
  if (actor.role === "admin") {
    if (key === "subt" && session?.step === "a_sub_target") return adminTargetButton(chatId, actor, session.data, Number(value));
    if (await adminButton(chatId, actor, key, parts)) return;
  }
  if (!session) return home(chatId, actor);
  const data = session.data;

  if (key === "freq" && session.step === "freq" && (value === "monthly" || value === "weekly")) {
    return ask(chatId, "amount", { ...data, frequency: value }, lang, giving);
  }
  if (key === "mday" && session.step === "mday") {
    const monthDay = Number(value);
    if (monthDay >= 1 && monthDay <= 28) return ask(chatId, "lang", { ...data, monthDay }, lang, giving);
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
  if (key === "lang" && session.step === "lang" && (value === "en" || value === "am")) {
    return ask(chatId, "email", { ...data, locale: value }, lang, giving);
  }
  if (key === "email" && value === "skip" && session.step === "email") return ask(chatId, "confirm", { ...data, email: "" }, lang, giving);
  if (key === "restart") return ask(chatId, "name", {}, lang, giving);
  if (key === "ok" && session.step === "confirm") return finish(chatId, actor, data);
  // A stale button: ask the current question again.
  return ask(chatId, session.step, data, lang, giving);
}
