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

export interface StoryHighlight {
  value: number;
  label: string;
}

interface Props {
  chapters: StoryChapter[];
  /** Numbers that count up beside a chapter's text, by chapter index. */
  highlights?: Record<number, StoryHighlight[]>;
  label: string;
  scrollHint: string;
  donate: string;
  more: string;
}

// The home page's closing story: an illustrated valley that stays on screen
// while the visitor scrolls through five chapters — night over South Omo, the
// light ("Beza") rising, sixteen children finding a home, the family growing
// with a school and a farm, and the visitor's part.
//
// How it moves:
//  • scroll-scrubbed (set every frame from the scroll position): the camera
//    (pan and zoom between chapters), the sun and moon, the time of day (sky
//    and the light on the land) and the parallax of the layers;
//  • chapter-triggered (CSS transitions on data-chapter): the home and school
//    rising, children walking in, corn growing, lights, hearts and fireflies;
//  • the captions reveal word by word, numbers count up.
// All hand-drawn SVG with CSS, so it stays sharp and light. Reduced motion:
// no animation (motion.css).

const N = 5;

// Deterministic "random" numbers, so the server and the browser draw the same
// scene. (Integer hashing only: Math.sin can differ between Node and browsers.)
const rand = (seed: number) => {
  let t = (seed * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return Math.round((((t ^ (t >>> 14)) >>> 0) / 4294967296) * 1000) / 1000;
};

// ---- Scroll-scrubbed keyframes (one per chapter) -----------------------------

// x: on wide screens the captions sit on the left, so the scene leans right.
const CAM = [
  { s: 1.08, x: 120, y: -14 },
  { s: 1.0, x: 150, y: 0 },
  { s: 1.42, x: 230, y: -24 },
  { s: 1.14, x: 190, y: 8 },
  { s: 1.03, x: 160, y: 0 },
];
const SUN = [
  { x: 1180, y: 860 },
  { x: 1180, y: 520 },
  { x: 1130, y: 280 },
  { x: 1040, y: 240 },
  { x: 1270, y: 505 },
];
const MOON = [175, 470, 980, 980, 980];
const SKY = {
  night: [1, 0, 0, 0, 0],
  dawn: [0, 1, 0, 0, 0],
  day: [0, 0, 1, 1, 0],
  dusk: [0, 0, 0, 0, 1],
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Where we are between chapters: index i and an eased 0…1 toward i + 1 (it rests at each chapter). */
function at(p: number): [number, number] {
  const x = clamp(p * N - 0.5, 0, N - 1);
  const i = Math.min(N - 2, Math.floor(x));
  return [i, smooth(clamp((x - i - 0.18) / 0.64))];
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- Scene data ----------------------------------------------------------------

const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: rand(i + 1) * 1600,
  y: rand(i + 101) * 330,
  r: 0.7 + rand(i + 201) * 1.6,
  d: rand(i + 301) * 5,
}));
const SKIN = ["#6b3f22", "#7a4a2b", "#5a341c", "#8a5532"];
const CLOTH = ["#b4532a", "#d99a2b", "#2c5e96", "#3b8a5a", "#c9daee", "#e2723f", "#7a5aa6", "#f0c977"];

/** The first sixteen: where they wait across the valley, and where they stand at the home. */
const FIRST = Array.from({ length: 16 }, (_, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  const row = Math.floor(i / 8);
  const col = i % 8;
  return {
    x: 646 + col * 40 + row * 20,
    y: 760 + row * 24,
    fx: Math.round(side * (240 + rand(i + 401) * 380)),
    fy: Math.round(-70 - rand(i + 501) * 100),
    skin: SKIN[i % 4],
    cloth: CLOTH[i % 8],
    s: Math.round((0.95 + rand(i + 601) * 0.2) * 100) / 100,
  };
});
/** The family today: seventeen more. */
const MORE = Array.from({ length: 17 }, (_, i) => ({
  x: i < 9 ? 452 + i * 30 : 1000 + (i - 9) * 34,
  y: 786 + (i % 3) * 12,
  skin: SKIN[(i + 2) % 4],
  cloth: CLOTH[(i + 3) % 8],
  s: Math.round((0.82 + rand(i + 701) * 0.14) * 100) / 100,
  d: (i * 0.07).toFixed(2),
  wave: i % 4 === 1,
}));
const CORN = Array.from({ length: 14 }, (_, i) => ({ x: 110 + i * 24, h: Math.round(70 + rand(i + 801) * 40), d: (i * 0.06).toFixed(2), row: i % 2 }));
const GRASS = Array.from({ length: 34 }, (_, i) => ({ x: Math.round(-60 + i * 52 + rand(i + 901) * 30), h: Math.round(16 + rand(i + 951) * 22), d: (rand(i + 991) * -3).toFixed(2) }));
const FLIES = Array.from({ length: 26 }, (_, i) => ({
  x: Math.round(380 + rand(i + 1101) * 860),
  y: Math.round(560 + rand(i + 1201) * 280),
  dx: Math.round(-40 + rand(i + 1301) * 80),
  dy: Math.round(-50 + rand(i + 1401) * 60),
  dur: (4 + rand(i + 1501) * 4).toFixed(2),
  d: (rand(i + 1601) * -6).toFixed(2),
}));

// ---- Little drawings ---------------------------------------------------------------

function Child({ c, className, style }: { c: { x: number; y: number; skin: string; cloth: string; s: number; wave?: boolean }; className: string; style?: CSSProperties }) {
  return (
    <g className={className} style={style}>
      <g transform={`translate(${c.x} ${c.y}) scale(${c.s})`}>
        <ellipse cx="0" cy="23" rx="11" ry="3.2" fill="rgba(7,21,38,.28)" />
        <g className="kid">
          <rect className="kid__leg kid__leg--l" x="-5" y="9" width="4" height="13" rx="2" fill={c.skin} />
          <rect className="kid__leg kid__leg--r" x="1" y="9" width="4" height="13" rx="2" fill={c.skin} />
          <rect x="-7.5" y="-8" width="15" height="21" rx="7" fill={c.cloth} />
          <rect className={`kid__arm${c.wave ? " kid__arm--wave" : ""}`} x="6" y="-6" width="3.6" height="13" rx="1.8" fill={c.skin} />
          <rect className="kid__arm kid__arm--l" x="-9.6" y="-6" width="3.6" height="13" rx="1.8" fill={c.skin} />
          <circle cx="0" cy="-15.5" r="7.6" fill={c.skin} />
          <path d="M-7.4 -17 a7.6 7.6 0 0 1 14.8 0 q-7.4 -3.6 -14.8 0z" fill="#2a1a10" />
        </g>
      </g>
    </g>
  );
}

function Acacia({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className="tree">
      <ellipse cx="0" cy="2" rx="70" ry="7" fill="rgba(7,21,38,.18)" />
      <path d="M-4 0 C-2 -30 -4 -50 -2 -62 M-3 -55 C-16 -70 -32 -78 -52 -84 M-2 -60 C8 -76 22 -84 40 -90 M-2 -44 C6 -54 14 -58 24 -62" stroke="#3d2a1c" strokeWidth="6" fill="none" strokeLinecap="round" />
      <g className="tree__crown">
        <path d="M-108 -86 Q-80 -116 -30 -118 Q10 -132 52 -120 Q96 -116 112 -92 Q70 -80 10 -84 Q-50 -76 -108 -86 Z" fill="#4c6b2e" />
        <path d="M-92 -94 Q-60 -116 -20 -114 Q20 -126 60 -114 Q90 -110 100 -96 Q60 -98 10 -100 Q-40 -94 -92 -94 Z" fill="#6a8a3a" />
      </g>
    </g>
  );
}

function Hut({ x, y, s, smoke }: { x: number; y: number; s: number; smoke?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {smoke ? (
        <g className="smoke">
          {[0, 1, 2].map((i) => (
            <circle key={i} cx="6" cy="-60" r="9" fill="#c9daee" style={{ animationDelay: `${i * 1.6}s` }} />
          ))}
        </g>
      ) : null}
      <path d="M-32 0 L-32 -22 L32 -22 L32 0 Z" fill="#9a6b45" />
      <path d="M-42 -20 Q0 -70 42 -20 Z" fill="#7a5233" />
      <path d="M-42 -20 Q0 -70 42 -20" fill="none" stroke="#5e3d24" strokeWidth="2" strokeDasharray="4 5" />
      <rect x="-7" y="-15" width="14" height="15" rx="3" fill="#2a1a10" />
    </g>
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 1400);
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, value]);
  return <>{n}</>;
}

// ---- The section ------------------------------------------------------------------

export default function StoryScroll({ chapters, highlights = {}, label, scrollHint, donate, more }: Props) {
  const root = useRef<HTMLElement>(null);
  const [chapter, setChapter] = useState(0);
  const [entered, setEntered] = useState(false);
  const lenis = useLenis();

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0;
    let last = -1;
    const narrow = window.matchMedia("(max-width: 760px)");
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? clamp(-rect.top / span) : 0;
      const [i, t] = at(p);
      const k = narrow.matches ? 0.45 : 1;
      const cam = { s: mix(CAM[i].s, CAM[i + 1].s, t), x: mix(CAM[i].x, CAM[i + 1].x, t), y: mix(CAM[i].y, CAM[i + 1].y, t) };
      const set = (name: string, v: number) => node.style.setProperty(name, v.toFixed(4));
      set("--p", p);
      set("--cs", 1 + (cam.s - 1) * k);
      set("--cx", narrow.matches ? 0 : cam.x);
      set("--cy", cam.y);
      set("--sunx", mix(SUN[i].x, SUN[i + 1].x, t) - (narrow.matches ? 250 : 0));
      set("--suny", mix(SUN[i].y, SUN[i + 1].y, t));
      set("--moony", mix(MOON[i], MOON[i + 1], t));
      const w = (key: keyof typeof SKY) => mix(SKY[key][i], SKY[key][i + 1], t);
      set("--night", w("night"));
      set("--dawn", w("dawn"));
      set("--day", w("day"));
      set("--dusk", w("dusk"));
      const c = Math.min(N - 1, Math.floor(clamp(p * N, 0, N - 0.001)));
      set("--cp", clamp(p * N - c));
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
    const seen = new IntersectionObserver(([e]) => e?.isIntersecting && setEntered(true), { threshold: 0.05 });
    seen.observe(node);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
      seen.disconnect();
    };
  }, []);

  const goTo = (i: number) => {
    const node = root.current;
    if (!node) return;
    const top = node.getBoundingClientRect().top + window.scrollY;
    const y = top + ((node.offsetHeight - window.innerHeight) * (i + 0.5)) / N;
    if (lenis) lenis.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <section
      ref={root}
      className={`story${entered ? " is-in" : ""}`}
      data-chapter={chapter}
      style={{ "--chapters": N } as CSSProperties}
      aria-label={label}
    >
      <div className="story__stage">
        <svg className="story__scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" role="img" aria-label={label}>
          <defs>
            <linearGradient id="sk-night" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#030a14" />
              <stop offset=".55" stopColor="#0a1d33" />
              <stop offset="1" stopColor="#1c3a5f" />
            </linearGradient>
            <linearGradient id="sk-dawn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a3560" />
              <stop offset=".38" stopColor="#6e5a8c" />
              <stop offset=".68" stopColor="#e8825a" />
              <stop offset="1" stopColor="#ffd58a" />
            </linearGradient>
            <linearGradient id="sk-day" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5f9fdc" />
              <stop offset=".55" stopColor="#bcd8f1" />
              <stop offset="1" stopColor="#fbefd6" />
            </linearGradient>
            <linearGradient id="sk-dusk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#172d55" />
              <stop offset=".42" stopColor="#7a4d7a" />
              <stop offset=".7" stopColor="#e2723f" />
              <stop offset="1" stopColor="#ffc46e" />
            </linearGradient>
            <radialGradient id="sk-sun" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#fffaf0" />
              <stop offset=".18" stopColor="#ffe9a8" />
              <stop offset=".45" stopColor="#f6c35f" stopOpacity=".45" />
              <stop offset="1" stopColor="#f0a94a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sk-moon" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#eaf2ff" stopOpacity=".55" />
              <stop offset="1" stopColor="#eaf2ff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sk-milky" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#9fb6e8" stopOpacity=".32" />
              <stop offset=".6" stopColor="#6d84c4" stopOpacity=".1" />
              <stop offset="1" stopColor="#6d84c4" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ld-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c3d5ea" />
              <stop offset="1" stopColor="#8fb0d2" />
            </linearGradient>
            <linearGradient id="ld-far2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8fa9c9" />
              <stop offset="1" stopColor="#6f8fb4" />
            </linearGradient>
            <linearGradient id="ld-mid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d6b47a" />
              <stop offset="1" stopColor="#c0955c" />
            </linearGradient>
            <linearGradient id="ld-near" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e1bf86" />
              <stop offset="1" stopColor="#c99a5d" />
            </linearGradient>
            <linearGradient id="ld-haze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ld-river" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#9cc8ee" />
              <stop offset=".5" stopColor="#5d93c9" />
              <stop offset="1" stopColor="#2f6aa6" />
            </linearGradient>
            <linearGradient id="hm-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fffaf2" />
              <stop offset="1" stopColor="#eadcc4" />
            </linearGradient>
            <linearGradient id="hm-roof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7d8896" />
              <stop offset="1" stopColor="#4f5967" />
            </linearGradient>
            <radialGradient id="lt-warm" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#fff1c2" stopOpacity=".95" />
              <stop offset=".4" stopColor="#ffc96a" stopOpacity=".45" />
              <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="lt-orb" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset=".18" stopColor="#fff2c4" />
              <stop offset=".5" stopColor="#ffd77a" stopOpacity=".4" />
              <stop offset="1" stopColor="#ffc95a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="lt-ray" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff4d0" stopOpacity="0" />
              <stop offset=".5" stopColor="#fff4d0" stopOpacity=".7" />
              <stop offset="1" stopColor="#fff4d0" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lt-trail" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#ffd58a" stopOpacity=".1" />
              <stop offset="1" stopColor="#ffe9b0" />
            </linearGradient>
            <clipPath id="ld-clip">
              <path transform="translate(0 -5)" d="M-400 520 L120 430 L230 470 L360 380 L480 460 L620 400 L760 460 L900 360 L1040 440 L1180 390 L1320 450 L1460 400 L2000 460 L2000 1300 L-400 1300 Z" />
            </clipPath>
          </defs>

          {/* ---- Sky (time of day blends with the scroll) ---- */}
          <rect width="1600" height="900" fill="url(#sk-night)" />
          <rect className="sky sky--dawn" width="1600" height="900" fill="url(#sk-dawn)" />
          <rect className="sky sky--day" width="1600" height="900" fill="url(#sk-day)" />
          <rect className="sky sky--dusk" width="1600" height="900" fill="url(#sk-dusk)" />

          <g className="nightsky">
            <ellipse cx="900" cy="150" rx="760" ry="70" fill="url(#sk-milky)" transform="rotate(-14 900 150)" />
            {STARS.map((s, i) => (
              <circle key={i} className="star" cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill="#fff" style={{ animationDelay: `-${s.d.toFixed(2)}s` }} />
            ))}
            <path className="shooting" d="M0 0 L-140 46" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          </g>

          <g className="moon">
            <circle cx="360" cy="0" r="120" fill="url(#sk-moon)" />
            <circle cx="360" cy="0" r="34" fill="#f2f6ff" />
            <circle cx="376" cy="-8" r="30" fill="#0b1d33" opacity=".92" />
          </g>

          <g className="sun">
            <circle r="260" fill="url(#sk-sun)" />
            <g className="sun__rays">
              {Array.from({ length: 14 }, (_, i) => (
                <path key={i} d="M-10 -120 L0 -420 L10 -120 Z" fill="url(#lt-ray)" opacity=".5" transform={`rotate(${i * (360 / 14)})`} />
              ))}
            </g>
            <circle r="58" fill="#fff4d6" />
          </g>

          <g className="clouds" fill="#fff">
            {[
              { x: 230, y: 175, s: 1, dur: 90, d: 0 },
              { x: 820, y: 120, s: 1.3, dur: 120, d: -50 },
              { x: 1320, y: 200, s: 0.8, dur: 100, d: -20 },
            ].map((c, i) => (
              <g key={i} className="cloud" style={{ animationDuration: `${c.dur}s`, animationDelay: `${c.d}s` }}>
                <g transform={`translate(${c.x} ${c.y}) scale(${c.s})`}>
                  <ellipse cx="0" cy="0" rx="110" ry="24" />
                  <ellipse cx="-36" cy="-14" rx="52" ry="26" />
                  <ellipse cx="34" cy="-20" rx="64" ry="32" />
                </g>
              </g>
            ))}
          </g>

          {/* ---- The world (camera, parallax, lit by the time of day) ---- */}
          <g className="cam">
            <g className="lyr lyr--far">
              <path d="M-400 520 L120 430 L230 470 L360 380 L480 460 L620 400 L760 460 L900 360 L1040 440 L1180 390 L1320 450 L1460 400 L2000 460 L2000 1100 L-400 1100 Z" fill="url(#ld-far)" />
              <path d="M-400 560 L60 500 L220 540 L420 470 L640 530 L880 470 L1100 525 L1320 480 L1560 520 L2000 500 L2000 1100 L-400 1100 Z" fill="url(#ld-far2)" />
              <rect className="haze" x="-400" y="470" width="2400" height="140" fill="url(#ld-haze)" />
            </g>
            <g className="lyr lyr--mid">
              <path d="M-400 630 Q-100 560 200 600 T760 585 T1250 600 T2000 580 L2000 1100 L-400 1100 Z" fill="url(#ld-mid)" />
              {[150, 420, 1180, 1420, 1650].map((x, i) => (
                <g key={x} transform={`translate(${x} ${600 + (i % 2) * 8})`} fill="#8a7a3c">
                  <circle cx="0" cy="0" r="11" />
                  <circle cx="13" cy="3" r="8" />
                  <circle cx="-12" cy="4" r="7" />
                </g>
              ))}
              <Hut x={230} y={612} s={0.9} smoke />
              <Hut x={1330} y={600} s={0.8} smoke />
              <Hut x={1460} y={612} s={0.6} />
            </g>

            <g className="lyr lyr--river">
              <path d="M2000 640 C1500 650 1330 700 1120 696 C900 690 860 770 640 792 C430 812 300 770 120 840 L-400 980" fill="none" stroke="url(#ld-river)" strokeWidth="30" strokeLinecap="round" className="river" pathLength={1} />
              <path d="M2000 640 C1500 650 1330 700 1120 696 C900 690 860 770 640 792 C430 812 300 770 120 840 L-400 980" fill="none" stroke="#e8f4ff" strokeWidth="3" strokeLinecap="round" className="river__shine" />
            </g>

            <g className="lyr lyr--near">
              <path d="M-400 740 Q300 690 640 735 T1300 722 T2000 712 L2000 1100 L-400 1100 Z" fill="url(#ld-near)" />
              <Acacia x={110} y={738} s={1.1} />
              <Acacia x={1480} y={728} s={1.3} />
              <Acacia x={1090} y={716} s={0.72} />
            </g>

            {/* The farm */}
            <g className="farm">
              {CORN.map((c, i) => (
                <g key={i} className="stalk" style={{ transitionDelay: `${c.d}s`, transformOrigin: `${c.x}px ${830 + c.row * 10}px` }}>
                  <g className="stalk__sway" style={{ animationDelay: `-${c.d}s`, transformOrigin: `${c.x}px ${830 + c.row * 10}px` }}>
                    <path d={`M${c.x} ${830 + c.row * 10} L${c.x} ${830 + c.row * 10 - c.h}`} stroke="#4a8a3a" strokeWidth="4" strokeLinecap="round" />
                    <path d={`M${c.x} ${830 + c.row * 10 - c.h * 0.42} q-18 -10 -26 -28 M${c.x} ${830 + c.row * 10 - c.h * 0.64} q18 -10 24 -26 M${c.x} ${830 + c.row * 10 - c.h * 0.85} q-12 -6 -16 -18`} stroke="#62a54c" strokeWidth="5" fill="none" strokeLinecap="round" />
                    <ellipse cx={c.x + 7} cy={830 + c.row * 10 - c.h * 0.74} rx="5" ry="11" fill="#f4cf6e" />
                  </g>
                </g>
              ))}
            </g>

            {/* The kindergarten */}
            <g className="school">
              <rect x="1012" y="694" width="176" height="96" rx="6" fill="url(#hm-wall)" />
              <rect x="1012" y="742" width="176" height="12" fill="#2c5e96" />
              <path d="M996 698 L1100 642 L1204 698 Z" fill="#1e4a7c" />
              <rect x="1084" y="728" width="32" height="62" rx="4" fill="#163454" />
              <rect x="1028" y="710" width="32" height="24" rx="3" fill="#f6d488" />
              <rect x="1140" y="710" width="32" height="24" rx="3" fill="#f6d488" />
              <path d="M1100 642 L1100 596" stroke="#5b6675" strokeWidth="3" />
              <path className="flag" d="M1100 598 Q1118 592 1136 600 Q1118 608 1100 616 Z" fill="#d99a2b" />
            </g>

            {/* The home: sand walls with the ochre bands of the Home Center */}
            <g className="home">
              <ellipse cx="800" cy="752" rx="230" ry="14" fill="rgba(7,21,38,.2)" />
              <rect x="618" y="612" width="364" height="136" rx="8" fill="url(#hm-wall)" />
              <rect x="618" y="680" width="364" height="16" fill="#d99a2b" />
              <rect x="618" y="702" width="364" height="8" fill="#b9781a" />
              <path d="M592 618 L800 526 L1008 618 Z" fill="url(#hm-roof)" />
              {Array.from({ length: 9 }, (_, i) => (
                <path key={i} d={`M${640 + i * 40} ${609 - (i < 5 ? i : 8 - i) * 18 * 0.9} L${640 + i * 40} 617`} stroke="rgba(255,255,255,.12)" strokeWidth="2" />
              ))}
              <path d="M592 618 L800 526 L1008 618" fill="none" stroke="#3d4653" strokeWidth="6" strokeLinejoin="round" />
              <rect x="768" y="654" width="64" height="94" rx="6" fill="#ffcf73" />
              <rect className="door" x="768" y="654" width="64" height="94" rx="6" fill="#123050" />
              {[650, 708, 862, 920].map((x) => (
                <g key={x}>
                  <rect x={x} y="632" width="36" height="38" rx="4" fill="#f6d488" />
                  <path d={`M${x + 18} 632 v38 M${x} 651 h36`} stroke="#c9a352" strokeWidth="2" />
                </g>
              ))}
              <path d="M800 526 L800 490 M787 503 L813 503" stroke="#f0c977" strokeWidth="6" strokeLinecap="round" />
              <path d="M838 660 l10 0 l0 14" stroke="#3d4653" strokeWidth="3" fill="none" />
              <circle cx="848" cy="678" r="5" fill="#ffd77a" />
            </g>

            {/* Children */}
            <g className="first">
              {FIRST.map((c, i) => (
                <Child
                  key={i}
                  c={c}
                  className="child"
                  style={{ "--fx": `${c.fx}px`, "--fy": `${c.fy}px`, transitionDelay: `${(i * 0.06).toFixed(2)}s` } as CSSProperties}
                />
              ))}
            </g>
            <g className="more">
              {MORE.map((c, i) => (
                <Child key={i} c={c} className="child child--more" style={{ transitionDelay: `${c.d}s` }} />
              ))}
            </g>

            <g className="lyr lyr--front">
              {GRASS.map((g, i) => (
                <g key={i} className="grass" style={{ animationDelay: `${g.d}s`, transformOrigin: `${g.x}px 900px` }}>
                  <path d={`M${g.x} 900 q-4 -${g.h} -10 -${g.h + 6} M${g.x} 900 q2 -${g.h + 6} 4 -${g.h + 12} M${g.x} 900 q6 -${g.h - 4} 14 -${g.h}`} stroke="#8a7a3c" strokeWidth="3" fill="none" strokeLinecap="round" />
                </g>
              ))}
            </g>

            {/* The light of day and night on the land */}
            <g clipPath="url(#ld-clip)" className="tints">
              <rect className="tint tint--night" x="-800" y="0" width="3200" height="1400" fill="#1a2a5a" />
              <rect className="tint tint--dawn" x="-800" y="0" width="3200" height="1400" fill="#f08a5d" />
              <rect className="tint tint--dusk" x="-800" y="0" width="3200" height="1400" fill="#d9703c" />
            </g>
          </g>

          {/* ---- Lights (above the tint, moving with the camera) ---- */}
          <g className="cam">
            <g className="glows">
              {[668, 726, 880, 938].map((x) => (
                <circle key={x} cx={x} cy="651" r="44" fill="url(#lt-warm)" />
              ))}
              <circle cx="1044" cy="722" r="30" fill="url(#lt-warm)" />
              <circle cx="1156" cy="722" r="30" fill="url(#lt-warm)" />
              <ellipse className="glows__door" cx="800" cy="760" rx="110" ry="34" fill="url(#lt-warm)" />
              <circle cx="848" cy="678" r="24" fill="url(#lt-warm)" />
            </g>

            <g className="orb">
              <g className="orb__rays">
                {Array.from({ length: 18 }, (_, i) => (
                  <path key={i} d={`M796 ${i % 2 ? 330 : 300} L800 230 L804 ${i % 2 ? 330 : 300} Z`} fill="url(#lt-ray)" transform={`rotate(${i * 20} 800 420)`} />
                ))}
              </g>
              <circle cx="800" cy="420" r="230" fill="url(#lt-orb)" />
              <circle className="orb__core" cx="800" cy="420" r="22" fill="#fffef6" />
            </g>

            <path className="trail" d="M60 940 C260 860 420 900 560 830 S760 790 800 752" fill="none" stroke="url(#lt-trail)" strokeWidth="6" strokeLinecap="round" />
            <path className="trail trail--glow" d="M60 940 C260 860 420 900 560 830 S760 790 800 752" fill="none" stroke="#ffd58a" strokeWidth="18" strokeLinecap="round" opacity=".18" />

            <path
              className="bigheart"
              pathLength={1}
              d="M800 470 C770 420 690 420 690 488 C690 548 760 584 800 612 C840 584 910 548 910 488 C910 420 830 420 800 470 Z"
              fill="none"
              stroke="#ffd58a"
              strokeWidth="5"
              strokeLinecap="round"
            />

            <g className="hearts">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <path
                  key={i}
                  className="heart"
                  style={{ animationDelay: `${(i * 0.55).toFixed(2)}s`, "--hx": `${(i % 4) * 90 - 135}px` } as CSSProperties}
                  d="M800 700 c-9 -15 -33 -13 -33 7 c0 17 24 28 33 37 c9 -9 33 -20 33 -37 c0 -20 -24 -22 -33 -7 z"
                  fill={i % 2 ? "#ff8a5c" : "#ffc46e"}
                />
              ))}
            </g>

            <g className="flies">
              {FLIES.map((f, i) => (
                <circle
                  key={i}
                  className="fly"
                  cx={f.x}
                  cy={f.y}
                  r="2.6"
                  fill="#ffe7a0"
                  style={{ "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, animationDuration: `${f.dur}s`, animationDelay: `${f.d}s` } as CSSProperties}
                />
              ))}
            </g>
          </g>
        </svg>

        <div className="story__fx" aria-hidden="true" />

        <div className="container story__ui">
          <div className="story__captions">
            {chapters.map((c, i) => (
              <article key={i} className={`story__caption${i === chapter ? " is-active" : ""}`} aria-hidden={i !== chapter}>
                <span className="story__count">
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <span>/ {String(chapters.length).padStart(2, "0")}</span>
                </span>
                <span className="story__eyebrow">{c.eyebrow}</span>
                <h2 className="story__title">
                  {c.title.split(/\s+/).map((word, w) => (
                    <span key={w} className="story__word" style={{ "--w": w } as CSSProperties}>
                      <span>{word}</span>
                    </span>
                  ))}
                </h2>
                <p className="story__text">{c.text}</p>
                {highlights[i]?.length ? (
                  <div className="story__stats">
                    {highlights[i].map((h) => (
                      <div key={h.label}>
                        <strong>
                          <Count value={h.value} active={i === chapter} />
                        </strong>
                        <span>{h.label}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {i === chapters.length - 1 ? (
                  <div className="btn-row story__actions">
                    <Link href="/donations" className="btn btn--gold btn--lg" tabIndex={i === chapter ? 0 : -1}>
                      <Icon name="heart" /> {donate}
                    </Link>
                    <Link href="/about" className="btn btn--ghost-light btn--lg" tabIndex={i === chapter ? 0 : -1}>
                      {more} <Icon name="arrowRight" />
                    </Link>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <nav className="story__timeline" aria-label={label}>
          {chapters.map((c, i) => (
            <button
              key={i}
              type="button"
              className={`${i === chapter ? "is-active" : ""}${i < chapter ? " is-done" : ""}`}
              onClick={() => goTo(i)}
              aria-current={i === chapter}
            >
              <span className="story__tl-bar">
                <span />
              </span>
              <span className="story__tl-label">{c.eyebrow}</span>
            </button>
          ))}
        </nav>

        <div className="story__hint" aria-hidden="true">
          <span>{scrollHint}</span>
          <span className="story__mouse" />
        </div>
      </div>
    </section>
  );
}
