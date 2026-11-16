# Moving the website to Yegara HOST

The website is a Node.js (Next.js) app. On Yegara it runs through cPanel's **Setup Node.js App**,
which needs the **Premium** hosting plan (Standard hosting can't run Node.js apps).

What lives where after the move:

| Part | Where |
| --- | --- |
| Website and dashboard | Yegara (cPanel → Setup Node.js App) |
| Uploaded photos, videos, documents | Yegara, in the `omobeeza/uploads` folder |
| Database | Neon (the same database as today, nothing to move) |
| Daily reminders | a cPanel cron job |
| Domain | `omobeezaministry.org`, with Yegara's nameservers |

Do the steps in order. The site on Vercel keeps working until step 6, so visitors see no gap.

## 1. The package

The ready package is `deploy/omobeeza-yegara.zip` in the project folder (about 160 MB). It was built
on 11 Nov 2026 with the current content. Later updates are covered under "Updating the website" below.

## 2. Create the app in cPanel

cPanel → **Setup Node.js App** → **Create application**:

| Field | Value |
| --- | --- |
| Node.js version | the newest offered (20 or later) |
| Application mode | Production |
| Application root | `omobeeza` |
| Application URL | `omobeezaministry.org` (leave the path empty) |
| Application startup file | `app.js` |

Click **Create**, then **Stop app** for now.

## 3. Upload the package

1. cPanel → **File Manager** → open the `omobeeza` folder (in your home folder).
2. Delete what cPanel put there (such as `app.js`, `public`, `tmp`), but leave anything named
   `node_modules` alone: it's a link cPanel manages.
3. **Upload** `omobeeza-yegara.zip`, wait until it shows 100%, then right-click it → **Extract** into
   `/omobeeza`.
4. You should now see `app.js`, `package.json` and a `server` folder. Delete the zip.

Do **not** click "Run NPM Install": everything the site needs is already inside `server`.

## 4. Settings (environment variables)

Setup Node.js App → your app (the pencil icon) → **Environment variables** → **Add variable** for each
line. Copy the values from Vercel → your project → **Settings → Environment Variables** (click the
eye icon to see a value), or from the `.env.local` file.

| Name | Value |
| --- | --- |
| `SITE_URL` | `https://www.omobeezaministry.org` |
| `DATABASE_URL` | the Neon connection string (same as on Vercel) |
| `GEMINI_API_KEY` | same as on Vercel (chat assistant) |
| `CRON_SECRET` | same as on Vercel, or any long random text (used again in step 8) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | same as on Vercel (email) |
| `TELEGRAM_BOT_TOKEN` | same as on Vercel, if set |
| `TELEGRAM_SUBADMIN_BOT_TOKEN` | the sub-admin bot's token, if you made one (see step 9) |
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION` | same as on Vercel, if set |

Don't add `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID` or anything starting with `VERCEL`: on Yegara,
uploads are stored on the server automatically.

Click **Save**, then **Start app**.

## 5. Check the `www` record

cPanel → **Zone Editor** → **Manage** next to `omobeezaministry.org`. There should be a record named
`www.omobeezaministry.org.` (type CNAME, pointing to `omobeezaministry.org`, or type A with the same
address as `omobeezaministry.org.`). If it is missing, click **+ Add Record** → **Add CNAME Record**:
name `www`, value `omobeezaministry.org`.

## 6. Point the domain to Yegara

At the moment the domain uses Vercel's nameservers (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`).

1. Yegara client area → **Domains** → `omobeezaministry.org` → **Nameservers**.
2. Choose **Use default nameservers** (Yegara's: `ns1.mysecurecloudhost.com` and
   `ns2.mysecurecloudhost.com`) and save.
3. Wait. Most networks see the change within a few hours, some take up to 24–48 hours.
   (`ipconfig /flushdns` on the computer helps you see it sooner.)
4. When the domain points to Yegara: cPanel → **SSL/TLS Status** → tick `omobeezaministry.org` and
   `www.omobeezaministry.org` → **Run AutoSSL**. The site needs `https://` (the Telegram bot and the
   apps require it).
5. Open **https://www.omobeezaministry.org**: the website should load. Sign in at `/admin` with the
   same accounts as before.

## 7. Copy the files from Vercel to Yegara

The photos, videos and documents uploaded so far are stored in Vercel Blob storage.

Dashboard (`/admin`) → the panel **Copy files from Vercel to this server** → click **Copy … files to
this server** and keep the page open until it says they were copied. If some fail, click again. It
is safe to repeat.

New uploads go straight to Yegara, into `omobeeza/uploads`.

## 8. Daily reminders (cron job)

cPanel → **Cron Jobs** → **Add New Cron Job**:

- **Minute** `0`, **Hour** `6`, and `*` for day, month and weekday. That is 9:00 Ethiopian time on
  a server set to UTC. (cPanel → **Terminal** → `date` shows the server's time; if it is already
  Ethiopian time, use hour `9`.)
- **Command** (put in your `CRON_SECRET`):
  ```
  curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://www.omobeezaministry.org/api/cron/reminders > /dev/null
  ```

It's safe if it runs twice: nobody gets two reminders on the same day.

## 9. Finish

1. Dashboard → **Giving & reminders**:
   - **Reconnect the bot**, so Telegram sends messages to the new address.
   - **Send a test email**. If it fails, see "Email" below.
   - **Connect the sub-admin bot**, if `TELEGRAM_SUBADMIN_BOT_TOKEN` is set (see "Sub-admins on iPhone" below).
2. On Ye-Buna, if you set a "thank you" or return link, change it to
   `https://www.omobeezaministry.org/thank-you`.
3. Phones: install **Omo Beeza Admin** (`android/release/OmoBeezaAdmin-v1.5.0.apk`) on the ministry
   phone and give sub-admins **Omo Beeza Sub-admin** (`android/release/OmoBeezaSubAdmin-v1.5.0.apk`).
   Both already use `https://www.omobeezaministry.org`. If the phone was signed in to the old app,
   sign in again.

## Sub-admins on iPhone (Telegram bot)

The Sub-admin app is Android only. Sub-admins with an iPhone register donors in a second Telegram bot
instead, with the same phone number and password.

1. In Telegram, open **@BotFather** → `/newbot` → a name such as `Omo Beeza Sub-admins` and a username
   ending in `bot`. Copy the token it gives you.
2. Add it as `TELEGRAM_SUBADMIN_BOT_TOKEN` in the environment variables (step 4) and restart the app.
3. Dashboard → **Giving & reminders** → **Sub-admin Telegram bot** → **Connect the sub-admin bot**.
4. Add the sub-admin in the Admin app as usual, and send them the bot's link (shown in that panel)
   with their password. In the bot they tap **Start** → **Share my phone number** → type the password.

Pausing a sub-admin, changing their password or removing them signs them out of the bot too.

## Vercel afterwards

Once the domain points to Yegara, Vercel gets no more visitors. You don't need to delete anything.
In particular, **don't delete the database under Vercel → Storage**: it's the Neon database the site
on Yegara still uses. After step 7, the Blob store is no longer used.

## Email

Shared hosting sometimes blocks connections to outside mail servers such as Gmail. If the test email
fails with Gmail, use a mailbox on Yegara:

1. cPanel → **Email Accounts** → **Create**, for example `giving@omobeezaministry.org`.
2. Change the settings: `SMTP_HOST` = `mail.omobeezaministry.org`, `SMTP_PORT` = `465`,
   `SMTP_USER` = the full address, `SMTP_PASS` = its password,
   `EMAIL_FROM` = `Omo Beeza Ministry <giving@omobeezaministry.org>`.
3. Restart the app and send a test email again.

Yegara allows about 150 outgoing emails per hour.

## Updating the website later

1. Get a new package, either way:
   - **GitHub** (once): repository → **Settings** → **Secrets and variables** → **Actions** →
     **New repository secret**, name `DATABASE_URL`, value the Neon connection string. Then:
     **Actions** → **Build for Yegara** → **Run workflow**. Wait for the green tick, open the run,
     download **omobeeza-yegara**, and unzip it once to get `omobeeza-yegara.zip`.
   - **On a computer** with the project: `npm run build:yegara` → `deploy/omobeeza-yegara.zip`.
2. File Manager → `omobeeza`: delete the `server` folder only. **Keep `uploads`**: it holds all
   photos and videos. Upload the new zip, extract it there, and delete the zip.
3. Setup Node.js App → **Restart**.

## If something goes wrong

- **503 error or "Incomplete response":** the app couldn't start. Check that the startup file is
  `app.js` and Node.js is 20 or newer, then restart. The error log is `omobeeza/stderr.log` (or
  cPanel → **Errors**).
- **Photos don't load but pages do:** the server can't run the photo resizer. Build the package
  with **Serve photos without resizing** ticked (GitHub), or run
  `IMAGES_UNOPTIMIZED=1 npm run build:yegara`, and upload that package.
- **The site shows old text or photos right after an update:** the package was built without the
  database (the `DATABASE_URL` secret is missing). Add it and build again.
- **The site is slow or stops:** Yegara limits each account (processes, memory). Restart the app; if
  it keeps happening, the site needs a Yegara VPS.
