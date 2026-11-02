// The website text sections shown in the dashboard's "Website text" editor,
// in a friendly order with plain-language names. Keys are the namespaces in
// messages/*.json. Any namespace not listed here still appears under "Other".

export interface Section {
  ns: string;
  title: string;
  descr: string;
}

export const SECTION_GROUPS: { title: string; sections: Section[] }[] = [
  {
    title: "Pages",
    sections: [
      { ns: "home", title: "Home page", descr: "Hero, statistics, story, why we exist, gratitude, testimonial…" },
      { ns: "about", title: "About page", descr: "Story, mission & vision, values, history timeline, South Omo." },
      { ns: "programs", title: "Programs page", descr: "Education, care, community programs, approach, places." },
      { ns: "involved", title: "Get Involved page", descr: "Pray, give, serve and partner sections." },
      { ns: "stories", title: "Stories page", descr: "Page text and the 'Life at Omo Beeza' photo gallery." },
      { ns: "gallery", title: "Gallery pages", descr: "Gallery headings and the prayer-wall wording." },
      { ns: "videos", title: "Videos page", descr: "Headings, the logo story, and video labels." },
      { ns: "donations", title: "Donate page", descr: "Donation page text, gift impact amounts, bank wording." },
      { ns: "giving", title: "Weekly giving", descr: "Weekly birr giving form (Ye-Buna), success message and the stop-reminders page." },
      { ns: "careers", title: "Careers page", descr: "Why serve, open positions, application form labels." },
      { ns: "contact", title: "Contact page", descr: "Contact page text and form subjects." },
      { ns: "faq", title: "FAQ page", descr: "Questions and answers, grouped by topic." },
      { ns: "legal", title: "Privacy & Terms", descr: "Privacy Policy and Terms of Use pages." },
      { ns: "blog", title: "Blog page labels", descr: "Headings and buttons on the blog pages." },
    ],
  },
  {
    title: "Shared sections",
    sections: [
      { ns: "ways", title: "Ways to help", descr: "The Pray / Give / Serve / Partner cards." },
      { ns: "needs", title: "Current needs", descr: "Home Center and Kindergarten project lists." },
      { ns: "prayer", title: "Prayer requests", descr: "The list of prayer requests." },
      { ns: "scripture", title: "Scripture banner", descr: "The Bible verse banner." },
      { ns: "cta", title: "Closing banner", descr: "The donate banner at the end of most pages." },
      { ns: "nav", title: "Menu labels", descr: "Navigation menu and footer link names." },
      { ns: "topbar", title: "Top bar", descr: "The verse in the thin bar above the menu." },
      { ns: "footer", title: "Footer", descr: "Motto and footer headings." },
      { ns: "meta", title: "Search & sharing", descr: "Page titles and descriptions for Google and social media." },
    ],
  },
  {
    title: "Interface text",
    sections: [
      { ns: "common", title: "Buttons & labels", descr: "Common words used across the site." },
      { ns: "forms", title: "Forms", descr: "Form messages and the prayer form." },
      { ns: "newsletter", title: "Newsletter", descr: "Footer sign-up box." },
      { ns: "chat", title: "Chat assistant", descr: "Chat window wording and suggested questions." },
      { ns: "notFound", title: "Page not found", descr: "The 404 page." },
    ],
  },
];

export const KNOWN_SECTIONS = new Set(SECTION_GROUPS.flatMap((g) => g.sections.map((s) => s.ns)));

export function sectionInfo(ns: string): Section {
  for (const g of SECTION_GROUPS) {
    const s = g.sections.find((x) => x.ns === ns);
    if (s) return s;
  }
  return { ns, title: ns, descr: "" };
}
