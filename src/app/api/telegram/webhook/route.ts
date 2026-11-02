import { hasDb, query, queryOne } from "@/lib/db";
import { readGivingNow } from "@/lib/data/giving";
import { dayName, normalizePhone } from "@/lib/giving";
import { giveButton } from "@/lib/reminders";
import { publicOrigin } from "@/lib/sms";
import { sendTelegram, tg, webhookSecret } from "@/lib/telegram";

// POST /api/telegram/webhook — Telegram delivers every message sent to the
// ministry's bot here (connected from Dashboard → Giving & SMS). The bot links
// a Telegram chat to a weekly donor, by:
//   • the personal link / QR from the app or thank-you page (/start <token>),
//   • the @username saved with their registration, or
//   • the phone number they share with the bot ("Share my phone number").
// Commands: /start, /stop, /status, /help.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
}
interface TgMessage {
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  contact?: { phone_number: string; user_id?: number };
}

interface LinkDonor {
  id: number;
  name: string;
  amount: number;
  reminder_day: number;
  locale: string;
  status: string;
  telegram_chat_id: string | null;
}

const ok = () => new Response("ok");

const T = {
  en: {
    linked: (name: string, amount: string, day: string) =>
      `Hello ${name}! 🎉 You're connected.\n\nEvery ${day} I'll send you a short reminder for your weekly gift of ${amount} birr to the children of Omo Beeza. Thank you for standing with them!\n\nSend /stop at any time to stop reminders here.`,
    ask: "Welcome to Omo Beeza Ministry! 👋\n\nTo get your weekly giving reminders here, tap “Share my phone number” below so I can find your registration.",
    share: "📱 Share my phone number",
    notOwn: "Please share your own number using the button below.",
    notFound: (url: string) =>
      `I couldn't find a weekly giver with that number. You can register at ${url} and then send /start again.`,
    stopped: "You won't get reminders here any more. Send /start whenever you'd like them back. Thank you for every gift! 🙏",
    status: (amount: string, day: string, state: string) => `Your weekly gift: ${amount} birr, reminder every ${day}. Status: ${state}.`,
    notLinked: "This chat isn't connected to a weekly giver yet. Send /start to connect.",
    help: "I send weekly giving reminders for Omo Beeza Ministry.\n\n/start – connect\n/status – your weekly gift\n/stop – stop reminders here",
  },
  am: {
    linked: (name: string, amount: string, day: string) =>
      `ሰላም ${name}! 🎉 ተገናኝተዋል።\n\nበየ${day} ለኦሞ ቤዛ ልጆች ስለሚሰጡት ሳምንታዊ የ${amount} ብር ስጦታ አጭር ማሳሰቢያ እልክልዎታለሁ። ከእነርሱ ጋር ስለቆሙ እናመሰግናለን!\n\nማሳሰቢያዎቹን ለማቆም በማንኛውም ጊዜ /stop ይላኩ።`,
    ask: "ወደ ኦሞ ቤዛ ሚኒስትሪ እንኳን ደህና መጡ! 👋\n\nሳምንታዊ የስጦታ ማሳሰቢያዎችን እዚህ ለማግኘት፣ ምዝገባዎን እንዳገኝ ከታች ያለውን “ስልክ ቁጥሬን አጋራ” ይጫኑ።",
    share: "📱 ስልክ ቁጥሬን አጋራ",
    notOwn: "እባክዎ ከታች ባለው ቁልፍ የራስዎን ቁጥር ያጋሩ።",
    notFound: (url: string) => `በዚህ ቁጥር የተመዘገበ ሳምንታዊ ሰጪ አላገኘሁም። በ${url} ተመዝግበው /start እንደገና ይላኩ።`,
    stopped: "ከእንግዲህ እዚህ ማሳሰቢያ አይደርስዎትም። እንደገና ሲፈልጉ /start ይላኩ። ስለ ስጦታዎ ሁሉ እናመሰግናለን! 🙏",
    status: (amount: string, day: string, state: string) => `ሳምንታዊ ስጦታዎ፦ ${amount} ብር፣ ማሳሰቢያ በየ${day}። ሁኔታ፦ ${state}።`,
    notLinked: "ይህ ቻት ገና ከሳምንታዊ ሰጪ ጋር አልተገናኘም። ለመገናኘት /start ይላኩ።",
    help: "ለኦሞ ቤዛ ሚኒስትሪ ሳምንታዊ የስጦታ ማሳሰቢያዎችን እልካለሁ።\n\n/start – ለመገናኘት\n/status – ሳምንታዊ ስጦታዎ\n/stop – ማሳሰቢያዎቹን ለማቆም",
  },
};

const DONOR_COLS = "id, name, amount, reminder_day, locale, status, telegram_chat_id";

async function reply(chatId: number, text: string, extra: Record<string, unknown> = {}): Promise<void> {
  await tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true, ...extra });
}

async function link(donor: LinkDonor, msg: TgMessage): Promise<void> {
  const username = msg.from?.username?.toLowerCase() ?? "";
  await query(
    `update donors set telegram_chat_id = $1, telegram_linked_at = now(),
       telegram_username = case when $2 <> '' then $2 else telegram_username end
     where id = $3`,
    [String(msg.chat.id), username, donor.id],
  );
  const t = T[donor.locale === "am" ? "am" : "en"];
  const giving = await readGivingNow();
  await sendTelegram({
    chatId: String(msg.chat.id),
    text: t.linked(donor.name.split(/\s+/)[0] ?? donor.name, donor.amount.toLocaleString("en-US"), dayName(donor.reminder_day, donor.locale)),
    button: giveButton(giving, donor.locale),
    kind: "welcome",
    donorId: donor.id,
    label: `telegram:${donor.name}`,
  });
}

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret() || !process.env.TELEGRAM_BOT_TOKEN) {
    return new Response("forbidden", { status: 403 });
  }
  if (!hasDb()) return ok();

  let update: { message?: TgMessage };
  try {
    update = (await request.json()) as typeof update;
  } catch {
    return ok();
  }
  const msg = update.message;
  // Only private chats with a person.
  if (!msg || msg.chat.type !== "private" || !msg.from) return ok();

  const chatId = msg.chat.id;
  const linked = await queryOne<LinkDonor>(`select ${DONOR_COLS} from donors where telegram_chat_id = $1 order by id desc limit 1`, [String(chatId)]);
  const lang: "en" | "am" = (linked?.locale ?? (msg.from.language_code === "am" ? "am" : "en")) === "am" ? "am" : "en";
  const t = T[lang];
  const text = (msg.text ?? "").trim();
  const shareKeyboard = {
    reply_markup: { keyboard: [[{ text: t.share, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
  };

  try {
    // Shared phone number.
    if (msg.contact) {
      if (msg.contact.user_id !== msg.from.id) {
        await reply(chatId, t.notOwn, shareKeyboard);
        return ok();
      }
      const phone = normalizePhone(msg.contact.phone_number);
      const donor = phone ? await queryOne<LinkDonor>(`select ${DONOR_COLS} from donors where phone = $1`, [phone]) : null;
      if (donor) await link(donor, msg);
      else await reply(chatId, t.notFound(`${publicOrigin()}${lang === "am" ? "/am" : ""}/donations`), { reply_markup: { remove_keyboard: true } });
      return ok();
    }

    const [command, arg = ""] = text.split(/\s+/, 2);
    switch (command.toLowerCase().replace(/@\w+$/, "")) {
      case "/start": {
        // 1) Personal link from the app / thank-you page.
        if (/^[A-Za-z0-9_-]{8,40}$/.test(arg)) {
          const donor = await queryOne<LinkDonor>(`select ${DONOR_COLS} from donors where token = $1`, [arg]);
          if (donor) {
            await link(donor, msg);
            return ok();
          }
        }
        // 2) The @username saved with their registration.
        const username = msg.from.username?.toLowerCase();
        if (username) {
          const donor = await queryOne<LinkDonor>(`select ${DONOR_COLS} from donors where telegram_username = $1 order by id desc limit 1`, [username]);
          if (donor) {
            await link(donor, msg);
            return ok();
          }
        }
        // 3) Already connected.
        if (linked) {
          await link(linked, msg);
          return ok();
        }
        // 4) Ask for their phone number.
        await reply(chatId, t.ask, shareKeyboard);
        return ok();
      }
      case "/stop": {
        if (linked) await query("update donors set telegram_chat_id = null where telegram_chat_id = $1", [String(chatId)]);
        await reply(chatId, t.stopped, { reply_markup: { remove_keyboard: true } });
        return ok();
      }
      case "/status": {
        if (!linked) await reply(chatId, t.notLinked);
        else
          await reply(
            chatId,
            t.status(linked.amount.toLocaleString("en-US"), dayName(linked.reminder_day, linked.locale), linked.status),
          );
        return ok();
      }
      default:
        await reply(chatId, linked ? t.help : `${t.help}\n\n${t.notLinked}`);
        return ok();
    }
  } catch (err) {
    console.error("telegram webhook:", err);
    return ok();
  }
}
