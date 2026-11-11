# Hosting the website on Yegara HOST

The website is a Node.js (Next.js) app. On Yegara it needs the **Premium** hosting plan: Standard
hosting can't run Node.js apps. It runs through cPanel's **Setup Node.js App**.

What stays where it is:
- **Database:** Neon (the same `DATABASE_URL`). Nothing to move.
- **Uploaded photos and videos:** Vercel Blob (the same files and links). Yegara uses a token for it, see step 4.

Yegara asks that apps are **not built on the server** (a build uses too many processes), so the site
is built on GitHub and you upload the finished package.

## 1. Build the package

1. On GitHub, open the repository → **Actions** → **Build for Yegara** → **Run workflow** → **Run workflow**.
2. Wait for the green tick (about 5 minutes), open the run, and download **omobeeza-yegara** at the
   bottom of the page.
3. Unzip the download once. Inside is `omobeeza-yegara.zip`: that's the file to upload.

(On a computer, `npm run build:yegara` makes the same package in `deploy/omobeeza-yegara.zip`. Use
GitHub when you can: a package built on Windows can't resize photos on the Linux server.)

## 2. Create the app in cPanel

cPanel → **Setup Node.js App** → **Create application**:

| Field | Value |
| --- | --- |
| Node.js version | the newest offered (20 or later; 18.18 is the minimum) |
| Application mode | Production |
| Application root | `omobeeza` |
| Application URL | your domain (leave the path empty) |
| Application startup file | `app.js` |

Click **Create**, then **Stop app** for now.

## 3. Upload the package

1. cPanel → **File Manager** → open the `omobeeza` folder (in your home folder).
2. Delete what cPanel put there (for example `app.js`, `public`, `tmp`), but leave anything named
   `node_modules` alone: it's a link cPanel manages.
3. **Upload** `omobeeza-yegara.zip`, then right-click it → **Extract** into `/omobeeza`.
4. You should now see `app.js`, `package.json` and a `server` folder. Delete the zip.

Do **not** click "Run NPM Install": everything the site needs is already inside `server`.

## 4. Settings (environment variables)

In **Setup Node.js App** → your app → **Environment variables**, add (copy the values from Vercel →
Settings → Environment Variables, or from `.env.local`):

| Name | Value |
| --- | --- |
| `SITE_URL` | your address, e.g. `https://omobeezaministry.com` (required: links in messages use it) |
| `DATABASE_URL` | the Neon connection string |
| `GEMINI_API_KEY` | for the chat assistant |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → your Blob store → `.env.local` tab. (`BLOB_STORE_ID` only works on Vercel, so don't add it here.) |
| `CRON_SECRET` | any long random text (also used in step 6) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | email, see step 7 |
| `TELEGRAM_BOT_TOKEN` | if you use the bot |
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION` | only if you use the ministry Telegram account |

Click **Save**, then **Start app** (or **Restart**). Open your domain: the website should load.
Sign in at `/admin` with the same accounts as before.

## 5. Domain and HTTPS

Point the domain to Yegara and turn on SSL (cPanel → **SSL/TLS Status** → **Run AutoSSL**). The
Telegram bot needs `https://`.

## 6. Daily reminders (cron job)

On Vercel a built-in schedule ran the reminders. On Yegara, add it in cPanel → **Cron Jobs**:

- **Command** (put in your domain and your `CRON_SECRET`):
  ```
  curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://omobeezaministry.com/api/cron/reminders > /dev/null
  ```
- **Time:** 9:00 in Ethiopia. If the server clock is Ethiopian time: minute `0`, hour `9`. If it's
  UTC: minute `0`, hour `6`. (Run `date` in cPanel → **Terminal** to see which.)
- Every day, every month, every weekday.

It's safe if it runs twice: nobody gets two reminders on the same day.

## 7. Email

Shared hosting often blocks connections to outside mail servers such as Gmail. If **Send a test
email** (Dashboard → Giving & reminders) fails with Gmail, use a mailbox on Yegara instead:

1. cPanel → **Email Accounts** → **Create**, for example `giving@omobeezaministry.com`.
2. Settings: `SMTP_HOST` = `mail.omobeezaministry.com`, `SMTP_PORT` = `465`, `SMTP_USER` = the full
   address, `SMTP_PASS` = its password, `EMAIL_FROM` = `Omo Beeza Ministry <giving@omobeezaministry.com>`.
3. Restart the app and send a test email.

Yegara allows **150 outgoing emails per hour**. Reminders are spread over the week by each donor's
day, so this is enough for about 150 email donors a day.

## 8. Telegram bot

After the site is live on the new domain: Dashboard → **Giving & reminders** → **Reconnect the bot**,
so Telegram sends messages to the new address.

The optional ministry Telegram account opens a connection to Telegram during the daily reminder run.
If Yegara's firewall blocks it, the run falls back to email, and reminders still go out.

## Updating the website later

1. Run **Build for Yegara** on GitHub again and download the new package.
2. In File Manager, delete the `server` folder in `omobeeza` (keep the environment variables, they
   are stored by cPanel), upload and extract the new zip.
3. **Restart** the app.

## If something goes wrong

- **503 error or "Incomplete response":** the app couldn't start. In Setup Node.js App, check the
  startup file is `app.js` and the Node.js version is 18.18 or newer, then restart. The error log is
  `omobeeza/stderr.log` (or cPanel → **Errors**).
- **Photos don't load but pages do:** the server can't run the photo resizer. Run **Build for Yegara**
  again with **Serve photos without resizing** ticked, and upload that package.
- **The site is slow or stops:** Yegara limits each account (100 processes, memory "4X", 20 database
  connections at a time). Restart the app; if it keeps happening, the site needs a Yegara VPS.
- **Uploads in the dashboard say they're turned off:** `BLOB_READ_WRITE_TOKEN` is missing.
