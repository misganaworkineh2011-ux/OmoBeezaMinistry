# Test Plan & Results — Omo Beeza Ministry (Next.js rebuild)

Verified against the production build (`npm run build && npm run start`) and the dev
server, using a headless Chrome session at desktop (1280×900) and mobile (390×780).

Legend: ✅ pass · ⚠️ pass with note · ⛔ open item (see end).

## Build & type safety

| #   | Case                                                                                         | Result |
| --- | -------------------------------------------------------------------------------------------- | ------ |
| 1   | `tsc --noEmit` clean (no `any` per project rules)                                            | ✅     |
| 2   | `next build` succeeds; 23 routes prerendered (both locales + 2 blog posts × 2) + `/icon.svg` | ✅     |
| 3   | No build warnings (workspace root pinned via `outputFileTracingRoot`)                        | ✅     |

## Internationalization (English + Amharic)

| #   | Case                                                                                                  | Result                               |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 4   | `/` serves English, `/am` serves Amharic; `/en/*` redirects to unprefixed (`localePrefix: as-needed`) | ✅                                   |
| 5   | `<html lang>` flips `en`/`am`                                                                         | ✅                                   |
| 6   | Amharic renders in Noto Sans Ethiopic; English in Montserrat (headings) / Source Sans (body)          | ✅ (computed `font-family` verified) |
| 7   | Language switcher (dropdown) preserves the current path; active locale marked                         | ✅ (see Header update §)             |
| 8   | All namespaces present in both `en.json` and `am.json` (build fails on missing keys)                  | ✅                                   |

## Rebrand (orange → brand blue)

| #   | Case                                                                                      | Result                      |
| --- | ----------------------------------------------------------------------------------------- | --------------------------- | ------ | -------------------- | --- |
| 9   | `--ul-primary` = `#1E4A7C`; buttons/links/icons blue (`rgb(30,74,124)`)                   | ✅                          |
| 10  | No orange literals remain in `style.css` (grep `EB5310                                    | FAA019                      | FFA31A | rgba(235,…)` → none) | ✅  |
| 11  | Decorative SVGs recolored to blue (about heart, sub-title vector, cta, events, logo SVGs) | ✅                          |
| 12  | 404 image (orange PNG) brought on-brand via `hue-rotate` filter                           | ⚠️ stopgap — see open items |

## Pages render (both locales)

| #   | Page                                                                                        | Result                                           |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 13  | Home — banner, about, donations lead, programs preview, stats, gratitude, support accordion | ✅                                               |
| 14  | About — intro, Mission/Vision/History tabs (new Option-1 copy), Values, scripture CTA       | ✅                                               |
| 15  | Programs — alternating Education / Nutrition & Care / Joy & Community                       | ✅                                               |
| 16  | Stories — gallery (real photos) + featured testimonial                                      | ⚠️ only 4 real photos available — see open items |
| 17  | Blog — listing + post; MDX renders headings/blockquote/list; EN fallback when AM missing    | ✅                                               |
| 18  | Careers — "why serve" cards, "no open roles", general-interest form                         | ✅                                               |
| 19  | Donations — tiers + frequency + impact text + trust points                                  | ✅                                               |
| 20  | Contact — info cards, named contacts, message form                                          | ✅                                               |
| 21  | 404 — localized, styled, header/footer                                                      | ✅                                               |

## Interactions

| #   | Case                                                                                                                                                                                 | Result                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| 22  | About Mission/Vision/History — now stacked sections shown all at once (tabs removed; see Content update §)                                                                           | ✅                                    |
| 23  | Home accordion single-open behavior                                                                                                                                                  | ✅ (logic ported from `accordion.js`) |
| 24  | DonateForm: tier click syncs custom amount; submit shows localized success w/ amount                                                                                                 | ✅                                    |
| 25  | Careers / Contact forms: controlled, success state + mailto fallback                                                                                                                 | ✅                                    |
| 26  | Mobile (<992px): hamburger opens sidebar with all 7 links + language switcher; Esc/X close                                                                                           | ✅                                    |
| 27  | Sticky header on scroll>80 (passive listener) — search modal removed (see Header update §)                                                                                           | ✅                                    |
| 28  | Reveal scroll-in animations fire; disabled under `prefers-reduced-motion`                                                                                                            | ✅                                    |
| 28a | Page scrolls & is full-width — fixed legacy `body { position: fixed }` (template relied on `main.js` to reset it) → set to `relative` + `overflow-x: hidden`; no horizontal overflow | ✅                                    |

## Assets & console

| #   | Case                                                                                         | Result |
| --- | -------------------------------------------------------------------------------------------- | ------ |
| 29  | No broken images on home (15/15 load); flaticon glyphs render                                | ✅     |
| 30  | Console clean on content pages (only the missing-favicon 404, now fixed with `app/icon.svg`) | ✅     |

## Accessibility (Web Interface Guidelines — focused review)

| #   | Case                                                                                         | Result                                            |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 31  | Mobile menu: `role="dialog"`, `aria-modal`, `aria-hidden`, Esc closes, focus moved to closer | ✅                                                |
| 32  | Toggles use `aria-expanded` / `aria-controls`; icon buttons have `aria-label`                | ✅                                                |
| 33  | Tabs: `role=tablist/tab/tabpanel`, `aria-selected`, roving `tabindex`, arrow keys            | ✅                                                |
| 34  | Accordion headers are `<button aria-expanded>` with region body                              | ✅                                                |
| 35  | Contrast: `#1E4A7C` on white ≈ AA/AAA; `#99ccff` used only as tint/background, never text    | ✅                                                |
| 36  | Images have alt text; decorative images use empty alt                                        | ✅                                                |
| 37  | Full automated WIG audit (fetch ruleset + per-line)                                          | ⛔ recommended before launch (manual review done) |

## Header update (2026-05-22): search removed · wider Donate · language dropdown

Verified on the dev server (desktop 1440×900, Chrome) on `/` and after switching to `/am`.
| # | Case | Result |
|---|------|--------|
| H1 | Search icon removed from header actions (no `ul-header-search-opener` button in a11y tree) | ✅ |
| H2 | Search modal/markup and its state/effects removed from `Header.tsx` (no dead `searchOpen` refs) | ✅ |
| H3 | Donate button visibly longer (`min-width: 168px`); content left-aligned (`justify-content: flex-start`) so the icon hugs the left like the hero "Make Donation" button | ✅ |
| H4 | Language switcher renders as a dropdown: toggle shows current language (English / አማርኛ) + chevron | ✅ |
| H5 | Dropdown opens on click; chevron rotates 180° via `[aria-expanded="true"]` | ✅ |
| H6 | Menu lists both locales; active locale highlighted (`.active` + `aria-current`) | ✅ |
| H7 | Selecting አማርኛ navigates to `/am` and preserves path; nav + Donate ("ይለግሱ") translate | ✅ |
| H8 | Dropdown closes on outside click and Escape | ✅ |
| H9 | Toggle is a real `<button>` with `aria-haspopup="menu"` + `aria-expanded`; items are `<Link>`s (SSR-friendly, work without JS) | ✅ |
| H10 | `tsc --noEmit` clean; no `any` introduced | ✅ |

## Content update (2026-05-23): align site with the authoritative ministry profile

Verified on the dev server (Chrome) at `/` (EN) and `/am` (AM); `tsc --noEmit` clean, both JSON files parse, no console errors.
| # | Case | Result |
|---|------|--------|
| C1 | Home hero now shows the "Who We Are" paragraph (Luka, founded Sept 28 2022, **16** children) — EN + AM | ✅ |
| C2 | About intro: name meaning corrected — "Beza" = "light" (Tsemay), not "redemption"; no "መዋጀት/ቤዛነት" in AM | ✅ |
| C3 | Initial children count **15 → 16** in home about (descr + list) and About history paragraph — EN + AM | ✅ |
| C4 | Home stats read **33 / 200–300 / 22** (stat 1 relabeled "Children Sheltered (Luka & Bodi)") — EN + AM | ✅ |
| C5 | Footer motto = "Transformed Generation for a Transforming Nation" / "የተለወጠ ትውልድ ለሁለንተናዊ የሕዝቦች ለውጥ!" | ✅ |
| C6 | Mission reworded to Equip / Enlighten / Train — EN + AM | ✅ |
| C7 | About page: Mission/Vision/History render as 3 stacked cards (no `[role=tab]` buttons) — EN + AM | ✅ (now scroll-stacking — see Scroll-stacking §) |
| C8 | Core Values **replaced** with the 3 from the doc (Gospel Centrality, Bible-Based Ministry, Partnership), centered 3-up grid — EN + AM | ✅ |
| C9 | AM wording: "initiative" → **እንቅስቃሴ** (about intro + donations lead); hero uses client-supplied AM text | ✅ |

Notes / open items from this update:

- AM strings for the new/changed copy are AI-drafted (except the hero, supplied by the client) — pending native-speaker review.
- `nav.searchPlaceholder` remains in both message files but is now unused (search removed earlier).
- Per client scope, NOT added this round: Team/missionaries section, Medical Mission program, Strategic Priorities, ETB sponsorship detail. Email/phone unchanged.

## Scroll-stacking About cards + smooth scroll (2026-05-23)

The About Mission/Vision/History cards are now CSS sticky **scroll-stacking** cards, with Lenis smooth scrolling site-wide. Verified on the dev server at `/en/about` and `/am/about`.
| # | Case | Result |
|---|------|--------|
| S1 | Each card in a full-viewport sticky figure (`position: sticky; top:0; min-height:100vh; place-content:center`); each card pins centered and the next rises to **cover/stack on top of it** in place — one viewport of scroll per card, last card ends on top (template behaviour). Verified `fig0` pins at `rectTop:0` while scrolling (EN + AM) | ✅ |
| S1b | **Pinned backdrop:** `.ul-stack-bg` (full-bleed `100vw`, `100vh`, sticky `top:0`, `margin-bottom:-100vh`, behind cards at `z-index:0`) holds the section background perfectly still while the cards stack; it releases right as the last card lands, so the whole section then scrolls away. Fixes "background scrolls while cards stack" | ⏳ user to confirm visually |
| S2 | Brand palette, one colour per card: Mission `#1E4A7C` (white), Vision `#99ccff` (`#143456`), History `#EDE6D9` (`#444444`), **Core Values `#444444` (white)**; subtle rotation on alternating cards | ✅ |
| S2b | **Core Values merged into the stack:** the standalone `ul-values` section was removed; the 3 values (Gospel Centrality / Bible-Based Ministry / Partnership) now render inside a single 4th stacking card (icon + title + descr each). Cards given a taller `min-height: clamp(380px,52vh,560px)` with vertically-centred content | ⏳ user to confirm visually |
| S3 | Cards are short/compact (`width: min(720px,92vw)`, content-height ~255–327px), centered, not full-width | ✅ |
| S4 | Lenis smooth scroll active site-wide (`html.lenis`) via `SmoothScroll` (`ReactLenis root`) in the locale layout; `lenis/dist/lenis.css` imported | ✅ |
| S5 | **Sticky fix (key bug):** `<body>` shipped `overflow-x: hidden`, which forces `overflow-y: auto` → makes body a nested scroll container and silently breaks `position: sticky`. Fixed with `body { overflow-x: clip }` (+ `main` `overflow-x: clip`) — clips horizontally without creating a scroll container, so sticky pins to the viewport | ✅ |
| S6 | Background stays static while cards move/stack; total stack scroll = 3 × 100vh, then normal flow resumes into Core Values | ✅ |
| S7 | Regression: header scroll-toggle (solid pill past 80px) and IntersectionObserver reveals still work under Lenis; sections after the stack render — EN + AM; no console errors | ✅ |
| S8 | `prefers-reduced-motion`: card rotation disabled | ✅ (rule present) |

New dependency: `lenis@1.3.23`. New files: `src/components/SmoothScroll.tsx`. Touched: `src/app/[locale]/layout.tsx`, `src/app/[locale]/about/page.tsx`, `public/css/app.css`.

## Open items (for the client / before launch)

1. **Real photography** — only 4 genuine ministry photos exist in assets; the rest are
   template placeholders. Supply real photos for the **Stories gallery**, **Programs**,
   **Careers** hero, and **Blog** covers.
2. **404 image** & remaining orange decorative **PNGs** (`about-vector-1.png`,
   `banner-img-vector-*.png`, `events-vector-1.png`) need proper blue versions from design
   (currently neutral or hue-rotated as a stopgap).
3. **Amharic translations** in `messages/am.json` and the Amharic blog post — review by a
   native speaker (drafted by AI).
4. **Impact numbers** — confirm real figures (children planned, partners, churches, staff).
5. **Donations payment** — wire a real processor (Stripe/PayPal) or bank-transfer
   instructions; confirm currency (USD vs ETB). Form currently captures intent + emails.
6. **Forms backend** — contact/careers forms show a success state and `mailto:` fallback;
   wire Formspree or a Route Handler + email service if a live inbox is required.
7. **Logo** — header/footer use the brand-blue PNG; confirm a favicon/og-image set is desired
   (a simple branded `app/icon.svg` was added).

## How to run

```bash
npm install
npm run dev      # http://localhost:3000  (/ = English, /am = Amharic)
npm run build && npm run start   # production
npm run typecheck                # tsc --noEmit
```

## Ignore rules update (2026-05-23)

| #   | Case                                                                                                                                        | Result |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| G1  | `.agent/` and `.claude/` entries in `.gitignore` match files such as `.agent/vercel-react-best-practices/AGENTS.md` and `.claude/claude.md` | ✅     |
