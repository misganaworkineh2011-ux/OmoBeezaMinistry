# Omo Beeza Ministry — Website

Bilingual (English + Amharic) **Next.js** site for Omo Beeza Ministry, a Christ-centered
children's ministry in the Jinka / South Omo Zone of Ethiopia. Custom design system built on
the brand kit (brand blue `#1E4A7C` with a warm ochre accent; Fraunces display headings,
Montserrat UI labels, Source Sans body, Noto Sans Ethiopic for Amharic).

## Stack
- **Next.js 15** (App Router) · **React 19** · **TypeScript** (strict, no `any`)
- **next-intl** for i18n (`en` default at `/`, `am` at `/am`)
- **next-mdx-remote** + gray-matter for the bilingual blog
- `next/image` for responsive, optimized photos · `next/font/google` for fonts
- Plain CSS design system in `src/app/globals.css` (no Bootstrap / icon font)
- Lenis smooth scrolling

## Run
```bash
npm install
npm run dev        # http://localhost:3000  →  / (English), /am (Amharic)
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```

## Pages
| Route | What it is |
| --- | --- |
| `/` | Home — hero, animated stats, story, "why we exist", programs, scripture, gratitude, ways to help, current needs, testimonial, latest posts |
| `/about` | Story & name meaning, mission/vision, values, history timeline, South Omo context |
| `/programs` | Education · Nutrition & Care · Joy & Community, holistic approach, Home Center & Kindergarten |
| `/get-involved` | Pray (requests + prayer form), Give (projects), Serve, Partner, Spread the word |
| `/gallery` | Photo-album hub (fanning photo stacks) + polaroid ribbon |
| `/gallery/luka` | "Pray for a child" wall: Luka site prayer cards that flip to reveal the prayer |
| `/gallery/carnival`, `/gallery/vision` | Event albums (bento grid + lightbox), with a "coming soon" state when empty |
| `/videos` | Documentary in a film-strip player, phone-style reels that preview silently, and the animated logo with its meaning |
| `/stories` | Filterable photo gallery with lightbox, testimonial, recent posts |
| `/blog`, `/blog/[slug]` | Featured post + grid; article with reading time, share buttons, related posts |
| `/donations` | Donation form (frequency, amounts, live impact), bank transfer with copy button, giving FAQ |
| `/careers` | Why serve, open positions, general-interest application |
| `/faq` | Grouped FAQ with FAQPage structured data |
| `/contact` | Contact cards, named contacts, message form, map |
| `/privacy`, `/terms` | Legal pages |

Also: `sitemap.xml`, `robots.txt`, per-page metadata + Open Graph, organization JSON-LD,
skip link, back-to-top with scroll progress, sticky "Give" button on phones.

## Forms
Contact, careers, prayer, newsletter, and donation forms are saved to the dashboard
**Inbox** (`/api/forms`). If no database is configured, they fall back to opening the
visitor's email app with a pre-filled message (see `src/lib/mailto.ts`).

## Project structure
```
src/
  app/
    globals.css              # the design system (tokens, layout, components, pages)
    fonts.ts                 # Fraunces / Montserrat / Source Sans / Noto Sans Ethiopic
    sitemap.ts  robots.ts
    [locale]/                # layout + every page listed above
  components/                # Header, Footer, PageHero, SectionHead, Icon, Reveal, Counter,
                             #   Accordion, Gallery, forms (FormKit, Contact/Careers/Prayer/
                             #   Donate/Newsletter), CtaBand, Scripture, PostCard, ShareButtons…
  i18n/                      # routing, navigation, request (English fallback merge)
  lib/                       # site.ts (contact, bank, socials), nav.ts, blog.ts,
                             #   metadata.ts, mailto.ts, donations.ts, rich.tsx
messages/en.json  am.json    # ALL site copy
content/blog/<slug>/         # en.mdx, am.mdx
public/img/photos/           # cleaned, web-optimized ministry photos
scripts/prepare-photos.mjs   # regenerates public/img/photos from the originals
```

## Photo galleries
Drop photos into these folders in `public/`, then run `npm run dev` or `npm run build`
(or `npm run galleries`). The pages update automatically:

| Folder | Album |
| --- | --- |
| `public/lukaSiteChildern/` | Children of the Luka Site (prayer cards; file name = child's name) |
| `public/carnival/` | Children's Carnival Day |
| `public/visionSharingDay/` | Vision Sharing Day at ACLA Church |

`scripts/prepare-galleries.mjs` optimizes each photo into `public/img/gallery/` and writes
`src/data/galleries.json`. For the Luka prayer cards it also crops the photo half as a portrait.
Album titles and descriptions live under `gallery` in `messages/*.json`.

## Videos
Put video files in `public/videos/` (or, better, `media-src/videos/` so the large originals
aren't published with the site). `npm run dev` / `npm run build` (or `npm run videos`) runs
`scripts/prepare-videos.mjs`, which uses ffmpeg (installed as a dev dependency) to create, in
`public/media/videos/`: a streamable MP4, a short silent preview loop and a poster image for
each video, plus `src/data/videos.json`. Results are cached, so only new or changed files are
processed. Titles live under `videos.items` in `messages/*.json`; poster moments and crops of
baked-in black bars are set in the `KNOWN` list at the top of the script.

## Chat assistant (Gemini)
A chat button on every page opens an assistant that answers questions about Omo Beeza **only**,
and **only** from the documents in `knowledge/`.

**Setup**
1. Get a Gemini API key at https://aistudio.google.com/apikey.
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY=...` (never commit this file).
   On your host (e.g. Vercel), add the same variable in the project settings.
3. Put your documents (PDF, Word .docx, Markdown, or text, English or Amharic) in `knowledge/`.
   They are processed automatically by `npm run dev` / `npm run build` (or `npm run knowledge`).

**How it works**
- `scripts/build-knowledge.mjs` extracts the text and splits it into passages -> `src/data/knowledge.json`.
- `POST /api/chat` (`src/app/api/chat/route.ts`) keeps the key on the server, sends Gemini the
  passages (all of them when the documents total under ~150,000 characters; otherwise the best
  keyword matches) with strict rules (`src/lib/chat/prompt.ts`), and streams the answer back.
- Limits: 15 questions per visitor per 5 minutes, 1,000 characters per question, last 8 messages
  of history. Identical first questions are cached for 6 hours.
- Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`).
- The chat window is only downloaded when a visitor opens it.

## Admin dashboard (`/admin`)
Everything on the site can be edited without touching code: website text in both languages,
contact details and bank account, blog posts, the prayer wall, photo albums, videos, and the
chatbot's documents. It also has a form **Inbox**, prayer counts, and privacy-friendly
**Analytics** (daily totals only, no cookies or IP addresses).

**Set up on Vercel (one time):**
1. **Database:** create a free project at [neon.tech](https://neon.tech) (or Vercel → Storage →
   Neon). Copy the *pooled* connection string into the Vercel environment variable
   `DATABASE_URL`. Tables are created automatically on first use.
2. **File storage:** Vercel → Storage → **Blob** → create a store and connect it to the project.
   This adds `BLOB_STORE_ID` (or, for older stores, `BLOB_READ_WRITE_TOKEN`) automatically.
3. Make sure `GEMINI_API_KEY` is set too, then redeploy.
4. Open `https://<your-site>/admin`. The first visit asks you to create the first admin
   account. Add other admins later under **Admins**.
5. On the Overview page click **Import existing website content**. This copies the current
   text, photos, videos, posts, and chatbot documents into the database so they can be edited.
   Until then, and whenever the database is unavailable, the site shows the bundled files.

**Locally:** `npm run dev` works without any setup. With no `DATABASE_URL` it uses a built-in
database in `.data/`, and uploads go to `public/uploads/` (both gitignored). Delete `.data/` to
start over. To work against the real database, put `DATABASE_URL` in `.env.local`.

Changes made in the dashboard appear on the site immediately (cached pages are refreshed).
Large videos: use MP4 (H.264). The dashboard reads the size and length and captures a poster frame.

## Editing content (in code)
- **Text / translations:** `messages/en.json` and `messages/am.json`. Any key missing from
  `am.json` automatically falls back to English (the Privacy/Terms bodies currently do).
  Wrap a word in `<em>…</em>` inside a heading to give it the italic accent color.
- **Contact details, bank account, social links:** `src/lib/site.ts`.
- **Navigation:** `src/lib/nav.ts`.
- **Icons:** names like `heart`, `book`, `users` (see `src/components/Icon.tsx`).
- **Photos:** add originals to `public/img/`, register them in `scripts/prepare-photos.mjs`,
  run `node scripts/prepare-photos.mjs`, and reference `/img/photos/<name>.jpg`.
  Gallery items in `stories.gallery` need the photo's width/height (`w`, `h`).
- **Add a blog post:** create `content/blog/<slug>/en.mdx` (and optional `am.mdx`) with
  frontmatter `title`, `date` (YYYY-MM-DD), `excerpt`, `cover`, `author`.
- **Colors / fonts:** tokens at the top of `src/app/globals.css`.

## Outstanding items
- Confirm impact numbers (33 sheltered, 22 in kindergarten) and the named contacts.
- Native-speaker review of Amharic, and Amharic text for the Privacy/Terms pages.
- An online payment processor for card donations; optional email notifications for new Inbox messages.
- More real photography (the gallery uses the six available photos).
- Have the Privacy Policy and Terms reviewed before launch.
