// Weekly or monthly giving in birr: shared types, defaults and helpers (safe to import
// from client components). Donors register on the Donations page (with their
// email) or in the Android app (with their phone), give on Ye-Buna, and get a
// reminder on the day they chose (a weekday, or a day of the month): on Telegram, by email (sent
// automatically), or by SMS (sent from the ministry phone with the app).

export interface GivingSettings {
  /** The Ye-Buna page where people give an amount of their own choice. */
  yebunaUrl: string;
  /** Suggested amounts in birr (weekly and monthly). */
  amounts: number[];
  /** A Ye-Buna payment link for each amount ("100" → https://ye-buna.com/pay/…). */
  amountLinks: Record<string, string>;
  minAmount: number;
  /** 0 = Sunday … 6 = Saturday (weekly donors). */
  defaultDay: number;
  /** What new donors choose unless they pick the other one. */
  defaultFrequency: Frequency;
  /** Day of the month for monthly donors' reminders (1–28). */
  defaultMonthDay: number;
  remindersEnabled: boolean;
  welcomeEnabled: boolean;
  /** Skip the reminder when a payment was recorded since the last one was due (6 days weekly, 25 days monthly). */
  skipIfPaid: boolean;
  /** Send weekly reminders on Telegram to donors who connected the bot. */
  telegramEnabled: boolean;
  /** For donors reached on Telegram, don't also send the email. (Stored under its old name.) */
  telegramReplacesSms: boolean;
  /** Reach donors who haven't connected the bot from the ministry's Telegram account (by @username or phone). */
  telegramUserEnabled: boolean;
  /** Put the personal "stop reminders" link ({stop}) in messages. Off: it is left out. */
  includeStopLink: boolean;
  /** SMS from the ministry phone (Android app), and Telegram messages. */
  reminderEn: string;
  reminderAm: string;
  welcomeEn: string;
  welcomeAm: string;
  /** Emails, sent automatically by the website. */
  emailReminderSubjectEn: string;
  emailReminderSubjectAm: string;
  emailReminderEn: string;
  emailReminderAm: string;
  emailWelcomeSubjectEn: string;
  emailWelcomeSubjectAm: string;
  emailWelcomeEn: string;
  emailWelcomeAm: string;
}

/** Every editable message template (Dashboard → Message templates). */
export const TEMPLATE_KEYS = [
  "reminderEn",
  "reminderAm",
  "welcomeEn",
  "welcomeAm",
  "emailReminderSubjectEn",
  "emailReminderSubjectAm",
  "emailReminderEn",
  "emailReminderAm",
  "emailWelcomeSubjectEn",
  "emailWelcomeSubjectAm",
  "emailWelcomeEn",
  "emailWelcomeAm",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const DEFAULT_GIVING: GivingSettings = {
  yebunaUrl: "https://ye-buna.com/pay/omobeeza-choice",
  amounts: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
  amountLinks: {
    "50": "https://ye-buna.com/pay/omobeeza-50",
    "100": "https://ye-buna.com/pay/omobeeza-100",
    "250": "https://ye-buna.com/pay/250",
    "500": "https://ye-buna.com/pay/omobeeza-500",
    "1000": "https://ye-buna.com/pay/omobeeza-1000",
    "2000": "https://ye-buna.com/pay/omobeeza-2000",
    "5000": "https://ye-buna.com/pay/omobeeza-5000",
    "10000": "https://ye-buna.com/pay/omobeeza-10000",
  },
  minAmount: 10,
  defaultDay: 0,
  defaultFrequency: "monthly",
  defaultMonthDay: 1,
  remindersEnabled: true,
  welcomeEnabled: true,
  skipIfPaid: true,
  telegramEnabled: true,
  telegramReplacesSms: true,
  telegramUserEnabled: true,
  includeStopLink: false,
  reminderEn: "Hi {name}, your {period} {amount} birr gift for the children of Omo Beeza: {link} Stop reminders: {stop}",
  reminderAm: "ሰላም {name}፣ ለኦሞ ቤዛ ልጆች {this} የ{amount} ብር ስጦታዎ፦ {link} ለማቆም፦ {stop}",
  welcomeEn: "Thank you {name}! You now give {amount} birr {every} to Omo Beeza. We'll remind you every {day}. Give: {link}",
  welcomeAm: "እናመሰግናለን {name}! {every} {amount} ብር ለኦሞ ቤዛ ይሰጣሉ። በየ{day} እናስታውስዎታለን። ይስጡ፦ {link}",
  emailReminderSubjectEn: "Your {period} gift for the children of Omo Beeza",
  emailReminderSubjectAm: "ለኦሞ ቤዛ ልጆች {period} ስጦታዎ",
  emailReminderEn:
    "Hi {name},\n\nThis is your {period} reminder for your {amount} birr gift to the children of Omo Beeza. Thank you for standing with them {every}.\n\nGive {this} gift: {link}\n\nWith gratitude,\nOmo Beeza Ministry\n\nTo stop these reminders: {stop}",
  emailReminderAm:
    "ሰላም {name}፣\n\nይህ ለኦሞ ቤዛ ልጆች የሚሰጡት {period} የ{amount} ብር ስጦታ ማሳሰቢያ ነው። {every} ከልጆቹ ጋር ስለቆሙ እናመሰግናለን።\n\n{this} ስጦታዎን ይስጡ፦ {link}\n\nከምስጋና ጋር፣\nኦሞ ቤዛ አገልግሎት\n\nማሳሰቢያዎቹን ለማቆም፦ {stop}",
  emailWelcomeSubjectEn: "Thank you for giving {period}, {name}!",
  emailWelcomeSubjectAm: "{name}፣ ስለ {period} ስጦታዎ እናመሰግናለን!",
  emailWelcomeEn:
    "Hi {name},\n\nThank you for committing {amount} birr {every} to the children of Omo Beeza. We'll send you a short reminder every {day}.\n\nGive your first gift: {link}\n\nWith gratitude,\nOmo Beeza Ministry\n\nTo stop these reminders: {stop}",
  emailWelcomeAm:
    "ሰላም {name}፣\n\nለኦሞ ቤዛ ልጆች {every} {amount} ብር ለመስጠት ስለወሰኑ እናመሰግናለን። በየ{day} አጭር ማሳሰቢያ እንልክልዎታለን።\n\nየመጀመሪያ ስጦታዎን ይስጡ፦ {link}\n\nከምስጋና ጋር፣\nኦሞ ቤዛ አገልግሎት\n\nማሳሰቢያዎቹን ለማቆም፦ {stop}",
};

/**
 * The templates as first shipped (weekly only). Settings saved before monthly
 * giving existed hold these texts; a saved template that is still exactly one
 * of them is replaced by the new default, which fits weekly and monthly donors.
 */
const TEMPLATES_V1: Partial<Record<TemplateKey, string>> = {
  reminderEn: "Hi {name}, your weekly {amount} birr gift for the children of Omo Beeza: {link} Stop reminders: {stop}",
  reminderAm: "ሰላም {name}፣ ለኦሞ ቤዛ ልጆች የዚህ ሳምንት የ{amount} ብር ስጦታዎ፦ {link} ለማቆም፦ {stop}",
  welcomeEn: "Thank you {name}! You now give {amount} birr weekly to Omo Beeza. We'll remind you every {day}. Give: {link}",
  welcomeAm: "እናመሰግናለን {name}! በየሳምንቱ {amount} ብር ለኦሞ ቤዛ ይሰጣሉ። በየ{day} እናስታውስዎታለን። ይስጡ፦ {link}",
  emailReminderSubjectEn: "Your weekly gift for the children of Omo Beeza",
  emailReminderSubjectAm: "ለኦሞ ቤዛ ልጆች ሳምንታዊ ስጦታዎ",
  emailReminderEn:
    "Hi {name},\n\nThis is your weekly reminder for your {amount} birr gift to the children of Omo Beeza. Thank you for standing with them every week.\n\nGive this week's gift: {link}\n\nWith gratitude,\nOmo Beeza Ministry\n\nTo stop these reminders: {stop}",
  emailReminderAm:
    "ሰላም {name}፣\n\nይህ ለኦሞ ቤዛ ልጆች የሚሰጡት ሳምንታዊ የ{amount} ብር ስጦታ ማሳሰቢያ ነው። በየሳምንቱ ከልጆቹ ጋር ስለቆሙ እናመሰግናለን።\n\nየዚህን ሳምንት ስጦታ ይስጡ፦ {link}\n\nከምስጋና ጋር፣\nኦሞ ቤዛ አገልግሎት\n\nማሳሰቢያዎቹን ለማቆም፦ {stop}",
  emailWelcomeSubjectEn: "Thank you for giving weekly, {name}!",
  emailWelcomeSubjectAm: "{name}፣ ስለ ሳምንታዊ ስጦታዎ እናመሰግናለን!",
  emailWelcomeEn:
    "Hi {name},\n\nThank you for committing {amount} birr every week to the children of Omo Beeza. We'll send you a short reminder every {day}.\n\nGive your first gift: {link}\n\nWith gratitude,\nOmo Beeza Ministry\n\nTo stop these reminders: {stop}",
  emailWelcomeAm:
    "ሰላም {name}፣\n\nለኦሞ ቤዛ ልጆች በየሳምንቱ {amount} ብር ለመስጠት ስለወሰኑ እናመሰግናለን። በየ{day} አጭር ማሳሰቢያ እንልክልዎታለን።\n\nየመጀመሪያ ስጦታዎን ይስጡ፦ {link}\n\nከምስጋና ጋር፣\nኦሞ ቤዛ አገልግሎት\n\nማሳሰቢያዎቹን ለማቆም፦ {stop}",
};

/** Saved settings → settings, with untouched old templates upgraded. */
export function withDefaults(saved: Partial<GivingSettings>): GivingSettings {
  const out: GivingSettings = { ...DEFAULT_GIVING, ...saved };
  // Settings saved before the "any amount" page existed have an empty link.
  if (!out.yebunaUrl) out.yebunaUrl = DEFAULT_GIVING.yebunaUrl;
  for (const key of TEMPLATE_KEYS) {
    if (saved[key] !== undefined && saved[key] === TEMPLATES_V1[key]) out[key] = DEFAULT_GIVING[key];
  }
  return out;
}

export type DonorStatus = "active" | "paused" | "stopped";
export const DONOR_STATUSES: DonorStatus[] = ["active", "paused", "stopped"];

export const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAYS_AM = ["እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "ዓርብ", "ቅዳሜ"];

/**
 * Ethiopian mobile numbers → +2519XXXXXXXX / +2517XXXXXXXX (Ethio telecom and
 * Safaricom). Accepts 09…, 07…, 9…, 2519…, +251 9… with spaces or dashes.
 * Returns null when it isn't a valid mobile number.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const m = digits.match(/^(?:251|0)?([79]\d{8})$/);
  return m ? `+251${m[1]}` : null;
}

/** +251911234567 → 0911 234 567 (how people write numbers locally). */
export function displayPhone(e164: string): string {
  const m = e164.match(/^\+251(\d)(\d{2})(\d{3})(\d{3})$/);
  return m ? `0${m[1]}${m[2]} ${m[3]} ${m[4]}` : e164;
}

export function dayName(day: number, locale: string): string {
  return (locale === "am" ? DAYS_AM : DAYS_EN)[((day % 7) + 7) % 7];
}

/** Fills {placeholders}. SMS text is one line; `multiline` keeps the line breaks (emails). */
export function fillTemplate(template: string, values: Record<string, string>, multiline = false): string {
  const filled = template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m);
  if (!multiline) return filled.replace(/\s+/g, " ").trim();
  return filled
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Where to pay a gift of `amount` birr on Ye-Buna: that amount's own payment
 * link, or the general Ye-Buna page ("" when neither is set).
 */
export function yebunaLink(giving: Pick<GivingSettings, "amountLinks" | "yebunaUrl">, amount?: number): string {
  return (amount ? giving.amountLinks?.[String(amount)] : "") || giving.yebunaUrl || "";
}

/**
 * Leaves the stop link out of a template: removes {stop} together with its
 * label ("Stop reminders: {stop}", "ለማቆም፦ {stop}", or a whole line in emails).
 */
export function withoutStop(template: string): string {
  return template
    .replace(/[^\n.!?።{}]*\{stop\}[ \t]*/g, "")
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
    .trim();
}

/** The template as sent: with or without the stop link, per the dashboard setting. */
export function templateFor(giving: Pick<GivingSettings, "includeStopLink">, template: string): string {
  return giving.includeStopLink ? template : withoutStop(template);
}

/** The name used in messages: the nickname if set, otherwise the first name. */
export function callName(name: string, nickname?: string | null): string {
  return nickname?.trim() || name.trim().split(/\s+/)[0] || name;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** SMS segments: 160 chars (GSM) or 70 for Unicode such as Amharic; longer messages use 153 / 67. */
export function smsSegments(text: string): { chars: number; segments: number; unicode: boolean } {
  // eslint-disable-next-line no-control-regex
  const unicode = /[^\x00-\x7F]/.test(text);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const chars = [...text].length;
  return { chars, unicode, segments: chars <= single ? 1 : Math.ceil(chars / multi) };
}

/** "@Abebe_K" / "t.me/abebe_k" → "abebe_k"; null when it isn't a valid Telegram username. */
export function normalizeTelegram(input: string): string | null {
  const v = input.trim().replace(/^(https?:\/\/)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "");
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v) ? v.toLowerCase() : null;
}

/** Today's weekday in Ethiopia (UTC+3, no daylight saving). */
export function ethiopiaWeekday(now = new Date()): number {
  return new Date(now.getTime() + 3 * 3_600_000).getUTCDay();
}

// ---- Weekly or monthly ----------------------------------------------------

export type Frequency = "weekly" | "monthly";
export const FREQUENCIES: Frequency[] = ["weekly", "monthly"];

export function asFrequency(value: unknown, fallback: Frequency = "monthly"): Frequency {
  return value === "weekly" || value === "monthly" ? value : fallback;
}

/** Monthly reminders go out on day 1–28, so every month has the day. */
export const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** 1 → "1st", 22 → "22nd". */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

/**
 * When the donor is reminded, to follow "every" ("every Monday", "every 5th of
 * the month") or "በየ" ("በየሰኞ", "በየወሩ 5ኛ ቀን").
 */
export function scheduleDay(frequency: string, weekday: number, monthDay: number, locale: string): string {
  if (frequency !== "monthly") return dayName(weekday, locale);
  return locale === "am" ? `ወሩ ${monthDay}ኛ ቀን` : `${ordinal(monthDay)} of the month`;
}

/** Words for templates and pages: {period} "weekly", {every} "every week", {this} "this week's". */
export function periodWords(frequency: string, locale: string): { period: string; every: string; this: string; per: string } {
  const monthly = frequency === "monthly";
  if (locale === "am") {
    return monthly
      ? { period: "ወርሃዊ", every: "በየወሩ", this: "የዚህ ወር", per: "በወር" }
      : { period: "ሳምንታዊ", every: "በየሳምንቱ", this: "የዚህ ሳምንት", per: "በሳምንት" };
  }
  return monthly
    ? { period: "monthly", every: "every month", this: "this month's", per: "a month" }
    : { period: "weekly", every: "every week", this: "this week's", per: "a week" };
}

/** Today in Ethiopia (UTC+3): the weekday and the day of the month. */
export function ethiopiaToday(now = new Date()): { weekday: number; monthDay: number } {
  const d = new Date(now.getTime() + 3 * 3_600_000);
  return { weekday: d.getUTCDay(), monthDay: d.getUTCDate() };
}

const ETHIOPIA_TODAY = "(now() at time zone 'Africa/Addis_Ababa')::date";

/**
 * SQL: the donor's latest reminder day up to and including today (Ethiopia
 * time). Weekly donors: the last <reminder_day> weekday; monthly donors: the
 * last <month_day> of a month (month_day is 1–28, so it exists every month).
 * `a` is the donors table alias.
 */
export function lastDueSql(a = "d"): string {
  return `(case when ${a}.frequency = 'monthly'
      then (date_trunc('month', ${ETHIOPIA_TODAY} - (${a}.month_day - 1))::date + (${a}.month_day - 1))
      else ${ETHIOPIA_TODAY} - ((extract(dow from ${ETHIOPIA_TODAY})::int - ${a}.reminder_day + 7) % 7)
    end)`;
}

/**
 * SQL: the donor's reminder day has come (this week for weekly donors, this
 * month for monthly ones) and they haven't been reminded since it (nor
 * registered on or after it). A missed day is caught up on the next run.
 */
export function reminderDueSql(a = "d"): string {
  return `((coalesce(${a}.last_reminded_at, ${a}.created_at) at time zone 'Africa/Addis_Ababa')::date < ${lastDueSql(a)})`;
}
