"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLenis } from "lenis/react";
import { Link } from "@/i18n/navigation";
import Icon from "@/components/Icon";

export interface StoryChapter {
  eyebrow: string;
  title: string;
  text: string;
}

interface Props {
  chapters: StoryChapter[];
  label: string;
  scrollHint: string;
  donate: string;
  more: string;
}

// The home page's illustrated story: a scene that stays on screen while the
// visitor scrolls through five chapters (night over South Omo → "Beza" means
// light → sixteen children find a home → a growing family, school and farm →
// your part). The scene is hand-drawn SVG; every move is a CSS transition keyed
// to the chapter (data-chapter) or to the scroll position (--p), so it stays
// light and sharp on every screen. Reduced motion: no transitions (globals.css).

const CHAPTERS = 5;

// Deterministic "random" numbers, so the server and the browser draw the same scene.
// (Integer hashing only: Math.sin can differ in the last digits between Node and browsers.)
const rand = (seed: number) => {
  let t = (seed * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return Math.round((((t ^ (t >>> 14)) >>> 0) / 4294967296) * 1000) / 1000;
};

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: rand(i + 1) * 1600,
  y: rand(i + 101) * 430,
  r: 0.8 + rand(i + 201) * 1.8,
  d: rand(i + 301) * 4,
}));

const SKIN = ["#6b3f22", "#7a4a2b", "#5a341c", "#8a5532"];
const CLOTH = ["#b4532a", "#d99a2b", "#2c5e96", "#3b8a5a", "#c9daee", "#e2723f", "#7a5aa6", "#f0c977"];

/** The first sixteen children: where they wait (scattered) and where they stand at the home. */
const FIRST = Array.from({ length: 16 }, (_, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  const row = Math.floor(i / 8);
  const col = i % 8;
  return {
    // In front of the home, two rows.
    x: 640 + col * 42 + row * 20,
    y: 742 + row * 26,
    // Scattered across the valley.
    fx: side * (260 + rand(i + 401) * 360),
    fy: -60 - rand(i + 501) * 110,
    skin: SKIN[i % SKIN.length],
    cloth: CLOTH[i % CLOTH.length],
    s: 0.92 + rand(i + 601) * 0.2,
  };
});

/** The family today: seventeen more join them. */
const MORE = Array.from({ length: 17 }, (_, i) => ({
  x: 470 + (i % 9) * 34 + (i > 8 ? 470 : 0),
  y: 770 + (i % 3) * 14,
  skin: SKIN[(i + 2) % SKIN.length],
  cloth: CLOTH[(i + 3) % CLOTH.length],
  s: 0.8 + rand(i + 701) * 0.15,
  d: i * 0.06,
}));

const CORN = Array.from({ length: 11 }, (_, i) => ({ x: 120 + i * 30, h: 70 + rand(i + 801) * 40, d: i * 0.07 }));

function Child({ x, y, skin, cloth, s, style, className }: { x: number; y: number; skin: string; cloth: string; s: number; style?: CSSProperties; className?: string }) {
  return (
    <g className={className} style={style}>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <g className="story-child__bob">
          <ellipse cx="0" cy="22" rx="10" ry="3" fill="rgba(7,21,38,.25)" />
          <rect x="-7" y="-8" width="14" height="22" rx="7" fill={cloth} />
          <rect x="-5" y="10" width="4" height="11" rx="2" fill={skin} />
          <rect x="1" y="10" width="4" height="11" rx="2" fill={skin} />
          <circle cx="0" cy="-15" r="7.5" fill={skin} />
        </g>
      </g>
    </g>
  );
}

function Acacia({ x, y, s, className }: { x: number; y: number; s: number; className?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-3 0 L-2 -60 Q-20 -78 -46 -84 M-2 -58 Q10 -80 38 -88 M-2 -40 Q8 -52 22 -58" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M-100 -88 Q-60 -122 0 -118 Q70 -122 104 -92 Q60 -80 0 -84 Q-60 -78 -100 -88 Z" fill="currentColor" />
    </g>
  );
}

function Hut({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g className="story-hut" transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-30 0 L-30 -22 L30 -22 L30 0 Z" fill="currentColor" opacity=".85" />
      <path d="M-40 -20 Q0 -66 40 -20 Z" fill="currentColor" />
      <rect x="-6" y="-14" width="12" height="14" rx="2" fill="rgba(0,0,0,.35)" />
    </g>
  );
}

export default function StoryScroll({ chapters, label, scrollHint, donate, more }: Props) {
  const root = useRef<HTMLElement>(null);
  const [chapter, setChapter] = useState(0);
  const lenis = useLenis();

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0;
    let last = -1;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      node.style.setProperty("--p", p.toFixed(4));
      const c = Math.min(CHAPTERS - 1, Math.floor(p * CHAPTERS * 0.999 + 0.0005));
      if (c !== last) {
        last = c;
        setChapter(c);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const goTo = (i: number) => {
    const node = root.current;
    if (!node) return;
    const top = node.getBoundingClientRect().top + window.scrollY;
    const span = node.offsetHeight - window.innerHeight;
    const y = top + (span * (i + 0.5)) / CHAPTERS;
    if (lenis) lenis.scrollTo(y, { duration: 1.4 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <section ref={root} className="story" data-chapter={chapter} style={{ "--chapters": CHAPTERS } as CSSProperties} aria-label={label}>
      <div className="story__stage">
        <svg className="story__scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" role="img" aria-label={label}>
          <defs>
            <linearGradient id="st-night" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#040d19" />
              <stop offset=".6" stopColor="#0b1f36" />
              <stop offset="1" stopColor="#1a3658" />
            </linearGradient>
            <linearGradient id="st-dawn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#14325a" />
              <stop offset=".45" stopColor="#6f5d86" />
              <stop offset=".75" stopColor="#e2723f" />
              <stop offset="1" stopColor="#f0c977" />
            </linearGradient>
            <linearGradient id="st-day" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8fbbe6" />
              <stop offset=".6" stopColor="#d9e8f5" />
              <stop offset="1" stopColor="#fbf1dc" />
            </linearGradient>
            <linearGradient id="st-dusk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1e4a7c" />
              <stop offset=".55" stopColor="#d99a2b" />
              <stop offset="1" stopColor="#fbe3b0" />
            </linearGradient>
            <radialGradient id="st-sun" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#fff6dc" />
              <stop offset=".35" stopColor="#f6d27c" />
              <stop offset="1" stopColor="#f0c977" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="st-light" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#fffbe9" />
              <stop offset=".25" stopColor="#ffe39a" />
              <stop offset=".6" stopColor="#f0c977" stopOpacity=".35" />
              <stop offset="1" stopColor="#f0c977" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="st-river" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7fb2e0" />
              <stop offset="1" stopColor="#3b6fa8" />
            </linearGradient>
            <linearGradient id="st-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fbf8f3" />
              <stop offset="1" stopColor="#efe5d4" />
            </linearGradient>
          </defs>

          {/* Sky: night, dawn, day and golden evening, cross-faded by chapter. */}
          <rect className="story-sky story-sky--night" width="1600" height="900" fill="url(#st-night)" />
          <rect className="story-sky story-sky--dawn" width="1600" height="900" fill="url(#st-dawn)" />
          <rect className="story-sky story-sky--day" width="1600" height="900" fill="url(#st-day)" />
          <rect className="story-sky story-sky--dusk" width="1600" height="900" fill="url(#st-dusk)" />

          <g className="story-stars">
            {STARS.map((s, i) => (
              <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill="#fff" style={{ animationDelay: `${s.d.toFixed(2)}s` }} />
            ))}
          </g>

          {/* The sun rises behind the hills. */}
          <g className="story-sun">
            <circle cx="1170" cy="300" r="190" fill="url(#st-sun)" opacity=".55" />
            <g className="story-sun__rays">
              {Array.from({ length: 12 }, (_, i) => (
                <rect key={i} x="1167" y="140" width="6" height="56" rx="3" fill="#f6d27c" opacity=".55" transform={`rotate(${i * 30} 1170 300)`} />
              ))}
            </g>
            <circle cx="1170" cy="300" r="62" fill="#ffe7a3" />
          </g>

          {/* Clouds and birds by day. */}
          <g className="story-clouds">
            <g className="story-cloud" style={{ animationDuration: "70s" }}>
              <ellipse cx="300" cy="170" rx="90" ry="26" fill="#fff" opacity=".8" />
              <ellipse cx="350" cy="155" rx="60" ry="26" fill="#fff" opacity=".8" />
            </g>
            <g className="story-cloud" style={{ animationDuration: "95s", animationDelay: "-30s" }}>
              <ellipse cx="900" cy="120" rx="110" ry="24" fill="#fff" opacity=".7" />
              <ellipse cx="960" cy="104" rx="70" ry="26" fill="#fff" opacity=".7" />
            </g>
          </g>
          <g className="story-birds" fill="none" stroke="#1e3b5e" strokeWidth="3" strokeLinecap="round">
            <path className="story-bird" d="M0 0 q10 -10 20 0 q10 -10 20 0" />
            <path className="story-bird" d="M0 0 q8 -8 16 0 q8 -8 16 0" style={{ animationDelay: "-4s" }} />
            <path className="story-bird" d="M0 0 q9 -9 18 0 q9 -9 18 0" style={{ animationDelay: "-9s" }} />
          </g>

          {/* Far mountains, middle hills, the valley floor. Near layers drift faster on scroll. */}
          <g className="story-layer story-layer--far">
            <path className="story-far" d="M0 520 L120 430 L230 480 L360 380 L480 470 L620 400 L760 470 L900 360 L1040 450 L1180 390 L1320 460 L1460 400 L1600 470 L1600 900 L0 900 Z" />
          </g>
          <g className="story-layer story-layer--mid">
            <path className="story-mid" d="M-100 610 Q120 520 330 580 T760 560 T1200 590 T1700 560 L1700 900 L-100 900 Z" />
            <Hut x={210} y={598} s={0.9} />
            <Hut x={1330} y={586} s={0.8} />
            <Hut x={1450} y={600} s={0.6} />
          </g>

          {/* The Omo River, drawn as the light comes. */}
          <path
            className="story-river"
            d="M1600 640 C1400 650 1320 700 1120 690 C900 680 860 760 640 780 C430 800 300 760 120 830 L-40 900"
            fill="none"
            stroke="url(#st-river)"
            strokeWidth="26"
            strokeLinecap="round"
            pathLength={1}
          />

          <g className="story-layer story-layer--near">
            <path className="story-ground" d="M-100 720 Q300 680 640 720 T1300 710 T1700 700 L1700 900 L-100 900 Z" />
            <Acacia className="story-tree" x={120} y={720} s={1.05} />
            <Acacia className="story-tree" x={1470} y={712} s={1.25} />
            <Acacia className="story-tree story-tree--small" x={1080} y={705} s={0.7} />
          </g>

          {/* The farm: corn grows once the family has roots. */}
          <g className="story-corn">
            {CORN.map((c, i) => (
              <g key={i} className="story-stalk" style={{ transitionDelay: `${c.d}s`, transformOrigin: `${c.x}px 812px` }}>
                <path d={`M${c.x} 812 L${c.x} ${812 - c.h}`} stroke="#4c8a3c" strokeWidth="4" strokeLinecap="round" />
                <path d={`M${c.x} ${812 - c.h * 0.45} q-18 -10 -26 -28 M${c.x} ${812 - c.h * 0.65} q18 -10 24 -26`} stroke="#5fa04a" strokeWidth="5" fill="none" strokeLinecap="round" />
                <ellipse cx={c.x + 7} cy={812 - c.h * 0.75} rx="5" ry="11" fill="#f0c977" />
              </g>
            ))}
          </g>

          {/* The kindergarten. */}
          <g className="story-school">
            <rect x="1010" y="690" width="170" height="92" rx="6" fill="url(#st-wall)" />
            <rect x="1010" y="738" width="170" height="12" fill="#2c5e96" />
            <path d="M996 694 L1095 640 L1194 694 Z" fill="#1e4a7c" />
            <rect x="1080" y="722" width="30" height="60" rx="4" fill="#0f2a47" />
            <rect x="1026" y="706" width="30" height="24" rx="3" fill="#ffd88a" className="story-window" />
            <rect x="1134" y="706" width="30" height="24" rx="3" fill="#ffd88a" className="story-window" />
            <path d="M1095 640 L1095 600" stroke="#5b6675" strokeWidth="3" />
            <path className="story-pennant" d="M1095 600 L1130 610 L1095 622 Z" fill="#d99a2b" />
          </g>

          {/* The home: sand walls with the ochre bands of the Home Center. */}
          <g className="story-home">
            <rect x="620" y="610" width="360" height="132" rx="8" fill="url(#st-wall)" />
            <rect x="620" y="676" width="360" height="16" fill="#d99a2b" />
            <rect x="620" y="698" width="360" height="8" fill="#b9781a" />
            <path d="M596 616 L800 528 L1004 616 Z" fill="#5b6675" />
            <path d="M596 616 L800 528 L1004 616" fill="none" stroke="#3f4957" strokeWidth="6" strokeLinejoin="round" />
            <rect x="770" y="652" width="60" height="90" rx="6" fill="#0f2a47" />
            <circle cx="818" cy="700" r="3.5" fill="#f0c977" />
            {[650, 710, 860, 920].map((x) => (
              <rect key={x} className="story-window" x={x} y="630" width="34" height="36" rx="4" fill="#ffd88a" />
            ))}
            <path d="M800 528 L800 494 M788 506 L812 506" stroke="#f0c977" strokeWidth="6" strokeLinecap="round" />
          </g>

          {/* Beza: a light rises over the valley, then settles on the home. */}
          <g className="story-light">
            <circle cx="800" cy="420" r="210" fill="url(#st-light)" />
            <g className="story-light__rays">
              {Array.from({ length: 16 }, (_, i) => (
                <rect key={i} x="797" y="270" width="6" height={i % 2 ? 46 : 70} rx="3" fill="#fff1c4" opacity=".7" transform={`rotate(${i * 22.5} 800 420)`} />
              ))}
            </g>
            <circle cx="800" cy="420" r="26" fill="#fffbe9" />
          </g>

          {/* The first sixteen: scattered at night, gathered at the home. */}
          <g className="story-first">
            {FIRST.map((c, i) => (
              <Child
                key={i}
                className="story-child"
                x={c.x}
                y={c.y}
                skin={c.skin}
                cloth={c.cloth}
                s={c.s}
                style={{ "--fx": `${c.fx.toFixed(0)}px`, "--fy": `${c.fy.toFixed(0)}px`, transitionDelay: `${(i * 0.05).toFixed(2)}s` } as CSSProperties}
              />
            ))}
          </g>
          <g className="story-more">
            {MORE.map((c, i) => (
              <Child key={i} className="story-child story-child--more" x={c.x} y={c.y} skin={c.skin} cloth={c.cloth} s={c.s} style={{ transitionDelay: `${c.d.toFixed(2)}s` }} />
            ))}
          </g>

          {/* Your part: a path of hearts from you to the home. */}
          <path className="story-trail" d="M80 900 C260 820 420 860 560 800 S760 760 800 730" fill="none" stroke="#f0c977" strokeWidth="5" strokeLinecap="round" />
          <g className="story-hearts">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path
                key={i}
                className="story-heart"
                style={{ animationDelay: `${i * 0.7}s`, "--hx": `${(i % 3) * 140 - 140}px` } as CSSProperties}
                d="M800 640 c-10 -16 -36 -14 -36 8 c0 18 26 30 36 40 c10 -10 36 -22 36 -40 c0 -22 -26 -24 -36 -8 z"
                fill="#e2723f"
              />
            ))}
          </g>
        </svg>

        <div className="story__shade" aria-hidden="true" />

        <div className="container story__ui">
          <div className="story__captions">
            {chapters.map((c, i) => (
              <article key={i} className={`story__caption${i === chapter ? " is-active" : ""}`} aria-hidden={i !== chapter}>
                <span className="story__count">
                  {String(i + 1).padStart(2, "0")} <span>/ {String(chapters.length).padStart(2, "0")}</span>
                </span>
                <span className="story__eyebrow">{c.eyebrow}</span>
                <h2 className="story__title">{c.title}</h2>
                <p>{c.text}</p>
                {i === chapters.length - 1 ? (
                  <div className="btn-row">
                    <Link href="/donations" className="btn btn--gold" tabIndex={i === chapter ? 0 : -1}>
                      <Icon name="heart" /> {donate}
                    </Link>
                    <Link href="/about" className="btn btn--ghost-light" tabIndex={i === chapter ? 0 : -1}>
                      {more} <Icon name="arrowRight" />
                    </Link>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <nav className="story__dots" aria-label={label}>
            {chapters.map((c, i) => (
              <button key={i} type="button" className={i === chapter ? "is-active" : undefined} onClick={() => goTo(i)} aria-label={`${i + 1}. ${c.title}`} aria-current={i === chapter}>
                <span />
              </button>
            ))}
          </nav>
        </div>

        <div className="story__hint" aria-hidden="true">
          <span>{scrollHint}</span>
          <span className="story__mouse" />
        </div>
        <div className="story__bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  );
}
