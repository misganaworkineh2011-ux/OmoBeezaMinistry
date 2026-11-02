// One-time sign-in for the ministry's Telegram account, which sends weekly
// reminders to donors who haven't pressed Start on the bot.
//
//   1. Get an API ID and hash at https://my.telegram.org → "API development tools".
//   2. Run:  npm run telegram-login
//   3. Enter the account's phone number, the code Telegram sends to it, and its
//      two-step password if it has one.
//   4. Copy the printed TELEGRAM_SESSION (and the API ID/hash) into Vercel →
//      Settings → Environment Variables, then redeploy.
//
// The session works like a password for that Telegram account: keep it private.
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const rl = readline.createInterface({ input, output });
const ask = async (q, fallback = "") => ((await rl.question(q)).trim() || fallback);

const apiId = Number(process.env.TELEGRAM_API_ID || (await ask("API ID (from my.telegram.org): ")));
const apiHash = process.env.TELEGRAM_API_HASH || (await ask("API hash: "));
if (!apiId || !apiHash) {
  console.error("An API ID and hash are required (https://my.telegram.org → API development tools).");
  process.exit(1);
}

const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 3 });
client.setLogLevel("error");

await client.start({
  phoneNumber: () => ask("Phone number of the ministry Telegram account (e.g. +2519…): "),
  phoneCode: () => ask("Code Telegram sent you: "),
  password: () => ask("Two-step verification password (press Enter if none): "),
  onError: (err) => console.error("Error:", err.message),
});

const me = await client.getMe();
console.log(`\nSigned in as ${[me.firstName, me.lastName].filter(Boolean).join(" ")}${me.username ? ` (@${me.username})` : ""}.\n`);
console.log("Add these in Vercel → Settings → Environment Variables (and keep them private):\n");
console.log(`TELEGRAM_API_ID=${apiId}`);
console.log(`TELEGRAM_API_HASH=${apiHash}`);
console.log(`TELEGRAM_SESSION=${client.session.save()}\n`);
await client.destroy();
rl.close();
process.exit(0);
