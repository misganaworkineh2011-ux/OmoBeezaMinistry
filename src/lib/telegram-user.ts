import "server-only";
import { query } from "@/lib/db";

// Reminders from the ministry's own Telegram *account* (not the bot), for
// donors who never pressed Start on the bot. A user account can message
// people by @username, or by phone number after adding them as a contact.
//   TELEGRAM_API_ID, TELEGRAM_API_HASH  from https://my.telegram.org → API development tools
//   TELEGRAM_SESSION                    from `npm run telegram-login` (keep it secret!)
// Use a dedicated ministry number. Telegram limits accounts that message many
// strangers, so sends are spaced out and stop for the day on a flood warning.

type Client = import("telegram").TelegramClient;

export function accountConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH && process.env.TELEGRAM_SESSION);
}

let connecting: Promise<Client> | null = null;

async function client(): Promise<Client> {
  connecting ??= (async () => {
    const { TelegramClient } = await import("telegram");
    const { StringSession } = await import("telegram/sessions");
    const c = new TelegramClient(new StringSession(process.env.TELEGRAM_SESSION ?? ""), Number(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH ?? "", {
      connectionRetries: 2,
    });
    c.setLogLevel("error" as never);
    await c.connect();
    if (!(await c.checkAuthorization())) throw new Error("TELEGRAM_SESSION is not signed in. Run `npm run telegram-login` again.");
    return c;
  })().catch((err: unknown) => {
    connecting = null;
    throw err;
  });
  return connecting;
}

/** Close the connection (call when a batch is done, so the server function can finish). */
export async function closeAccount(): Promise<void> {
  const pending = connecting;
  connecting = null;
  if (!pending) return;
  try {
    await (await pending).destroy();
  } catch {
    // already closed
  }
}

export async function accountInfo(): Promise<{ ok: boolean; name?: string; username?: string; phone?: string; error?: string }> {
  if (!accountConfigured()) return { ok: false, error: "Not set up" };
  try {
    const me = (await (await client()).getMe()) as { firstName?: string; lastName?: string; username?: string; phone?: string };
    return { ok: true, name: [me.firstName, me.lastName].filter(Boolean).join(" "), username: me.username ?? "", phone: me.phone ? `+${me.phone}` : "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not connect" };
  } finally {
    await closeAccount();
  }
}

export type AccountSend =
  | { ok: true; via: "username" | "phone" }
  | { ok: false; status: "not_on_telegram" | "privacy" | "flood" | "error"; error: string };

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

function classify(message: string): "privacy" | "flood" | "error" {
  if (/FLOOD|PEER_FLOOD|SLOWMODE/i.test(message)) return "flood";
  if (/PRIVACY|PREMIUM_REQUIRED|USER_IS_BLOCKED|YOU_BLOCKED|INPUT_USER_DEACTIVATED|USER_DEACTIVATED/i.test(message)) return "privacy";
  return "error";
}

/** Send one reminder from the ministry account: by @username first, then by phone number. */
export async function sendFromAccount(
  donor: { id: number; name: string; phone: string; telegram_username: string },
  text: string,
  kind: "reminder" | "test" = "reminder",
): Promise<AccountSend> {
  let result: AccountSend;
  try {
    const c = await client();
    result = { ok: false, status: "not_on_telegram", error: "Not found on Telegram" };
    if (donor.telegram_username) {
      try {
        await c.sendMessage(donor.telegram_username, { message: text, linkPreview: false });
        result = { ok: true, via: "username" };
      } catch (err) {
        const status = classify(errorText(err));
        // An unknown/changed username falls through to the phone number.
        if (status !== "error") result = { ok: false, status, error: errorText(err) };
      }
    }
    if (!result.ok && result.status === "not_on_telegram" && donor.phone) {
      const { Api } = await import("telegram");
      const bigInt = (await import("big-integer")).default;
      const [first, ...rest] = donor.name.trim().split(/\s+/);
      const imported = (await c.invoke(
        new Api.contacts.ImportContacts({
          contacts: [new Api.InputPhoneContact({ clientId: bigInt(donor.id), phone: donor.phone, firstName: first || donor.name, lastName: rest.join(" ") })],
        }),
      )) as { users: unknown[] };
      const user = imported.users[0];
      if (user) {
        try {
          await c.sendMessage(user as never, { message: text, linkPreview: false });
          result = { ok: true, via: "phone" };
        } catch (err) {
          result = { ok: false, status: classify(errorText(err)), error: errorText(err) };
        }
      }
    }
  } catch (err) {
    result = { ok: false, status: classify(errorText(err)), error: errorText(err) };
  }

  const status = result.ok ? "ok" : result.status;
  await query("update donors set telegram_user_status = $1, telegram_user_checked_at = now() where id = $2", [status, donor.id]).catch(() => {});
  await query(
    "insert into sms_log (donor_id, to_phone, message, kind, status, provider_id, error, channel) values ($1, $2, $3, $4, $5, '', $6, 'telegram')",
    [
      donor.id,
      result.ok ? `telegram-account:${result.via === "username" ? `@${donor.telegram_username}` : donor.phone}` : "telegram-account",
      text,
      kind,
      result.ok ? "sent" : "failed",
      result.ok ? "" : `${result.status}: ${result.error}`.slice(0, 500),
    ],
  ).catch(() => {});
  return result;
}
