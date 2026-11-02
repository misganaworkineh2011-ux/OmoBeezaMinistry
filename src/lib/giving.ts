// Weekly giving in birr: shared types, defaults and helpers (safe to import
// from client components). Donors register on the Donations page, give on
// Ye-Buna, and get a weekly SMS reminder (AfroMessage) on the day they chose.

export interface GivingSettings {
  /** The ministry's Ye-Buna page, e.g. https://ye-buna.com/omobeeza */
  yebunaUrl: string;
  /** Suggested weekly amounts in birr. */
  amounts: number[];
  minAmount: number;
  /** 0 = Sunday … 6 = Saturday. */
  defaultDay: number;
  remindersEnabled: boolean;
  welcomeEnabled: boolean;
  /** Skip the reminder when a payment was recorded in the last 6 days. */
  skipIfPaid: boolean;
  /** Send weekly reminders on Telegram to donors who connected the bot. */
  telegramEnabled: boolean;
  /** For donors reached on Telegram, don't also send the SMS (saves SMS costs). */
  telegramReplacesSms: boolean;
  reminderEn: string;
  reminderAm: string;
  welcomeEn: string;
  welcomeAm: string;
}

export const DEFAULT_GIVING: GivingSettings = {
  yebunaUrl: "",
  amounts: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
  minAmount: 10,
  defaultDay: 0,
  remindersEnabled: true,
  welcomeEnabled: true,
  skipIfPaid: true,
  telegramEnabled: true,
  telegramReplacesSms: true,
  reminderEn: "Hi {name}, your weekly {amount} birr gift for the children of Omo Beeza: {link} Stop reminders: {stop}",
  reminderAm: "ሰላም {name}፣ ለኦሞ ቤዛ ልጆች የዚህ ሳምንት የ{amount} ብር ስጦታዎ፦ {link} ለማቆም፦ {stop}",
  welcomeEn: "Thank you {name}! You now give {amount} birr weekly to Omo Beeza. We'll remind you every {day}. Give: {link}",
  welcomeAm: "እናመሰግናለን {name}! በየሳምንቱ {amount} ብር ለኦሞ ቤዛ ይሰጣሉ። በየ{day} እናስታውስዎታለን። ይስጡ፦ {link}",
};

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

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m).replace(/\s+/g, " ").trim();
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
