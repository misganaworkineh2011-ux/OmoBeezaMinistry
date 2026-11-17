"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon";

export interface MapFact {
  icon: IconName;
  title: string;
  text: string;
}

interface Props {
  head: ReactNode;
  facts: MapFact[];
  labels: { luqa: string; jinka: string; bodi: string; river: string; distance: string; note: string };
  mapLabel: string;
}

// About page: "a light in South Omo". A stylised map (not to scale): the Omo
// River draws itself, Jinka, Luqa and Bodi appear, the road from Jinka to Luqa
// marches, and light spreads out from the home in Luqa over the dark valley.
// Plays once, when scrolled into view.

const P = { bodi: [330, 270], jinka: [560, 420], luqa: [760, 540] } as const;
const pct = ([x, y]: readonly [number, number]) => ({ left: `${(x / 1200) * 100}%`, top: `${(y / 1000) * 100}%` });

const CONTOURS = [
  "M140 520 C180 300 420 180 640 210 C900 250 1080 380 1060 560 C1040 760 820 880 600 860 C360 840 110 740 140 520 Z",
  "M230 520 C260 360 440 270 640 290 C850 320 980 420 965 560 C950 710 790 800 610 785 C420 770 210 680 230 520 Z",
  "M330 525 C350 420 480 355 640 370 C800 390 885 460 870 560 C860 660 750 715 620 705 C480 695 320 630 330 525 Z",
  "M430 530 C445 470 530 430 640 440 C750 455 800 500 790 560 C780 625 710 650 630 645 C530 640 420 600 430 530 Z",
];

export default function LightMap({ head, facts, labels, mapLabel }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPlaying(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className={`section section--navy lightmap${playing ? " is-playing" : ""}`}>
      <div className="container lightmap__grid">
        <div className="lightmap__text">
          {head}
          <ul className="lightmap__facts">
            {facts.map((f) => (
              <li key={f.title}>
                <span className="icon-badge icon-badge--gold icon-badge--sm">
                  <Icon name={f.icon} />
                </span>
                <span>
                  <strong>{f.title}</strong>
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lightmap__map">
          <svg viewBox="0 0 1200 1000" preserveAspectRatio="xMidYMid slice" role="img" aria-label={mapLabel}>
            <defs>
              <radialGradient id="lm-ray" gradientUnits="userSpaceOnUse" cx={P.luqa[0]} cy={P.luqa[1]} r="520">
                <stop offset="0" stopColor="#f0c977" stopOpacity=".35" />
                <stop offset=".5" stopColor="#f0c977" stopOpacity=".08" />
                <stop offset="1" stopColor="#f0c977" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="lm-glow" cx=".5" cy=".5" r=".5">
                <stop offset="0" stopColor="#fff3cc" stopOpacity=".95" />
                <stop offset=".4" stopColor="#f0c977" stopOpacity=".45" />
                <stop offset="1" stopColor="#f0c977" stopOpacity="0" />
              </radialGradient>
            </defs>
            {CONTOURS.map((d, i) => (
              <path key={i} className="lightmap-contour" d={d} />
            ))}
            <g className="lightmap-rays">
              {Array.from({ length: 18 }, (_, i) => (
                <path
                  key={i}
                  d={`M${P.luqa[0]} ${P.luqa[1]} L${P.luqa[0] - 9} ${P.luqa[1] - 520} L${P.luqa[0] + 9} ${P.luqa[1] - 520} Z`}
                  fill="url(#lm-ray)"
                  transform={`rotate(${i * 20} ${P.luqa[0]} ${P.luqa[1]})`}
                />
              ))}
            </g>
            <path
              className="lightmap-river"
              pathLength={1}
              d="M150 -20 C210 120 340 160 300 300 C260 430 170 480 230 610 C290 740 420 760 380 880 C360 950 330 990 320 1020"
            />
            <path
              className="lightmap-road"
              pathLength={1}
              d={`M${P.jinka[0]} ${P.jinka[1]} C${P.jinka[0] + 70} ${P.jinka[1] + 10} ${P.luqa[0] - 120} ${P.luqa[1] - 80} ${P.luqa[0]} ${P.luqa[1]}`}
            />
            <circle className="lightmap-pulse" cx={P.luqa[0]} cy={P.luqa[1]} r="60" fill="none" stroke="#f0c977" strokeWidth="3" />
            <circle className="lightmap-pulse lightmap-pulse--2" cx={P.luqa[0]} cy={P.luqa[1]} r="60" fill="none" stroke="#f0c977" strokeWidth="3" />
            <circle cx={P.luqa[0]} cy={P.luqa[1]} r="120" fill="url(#lm-glow)" className="lightmap-dot lightmap-dot--luqa" />
            <g className="lightmap-dot lightmap-dot--jinka">
              <circle cx={P.jinka[0]} cy={P.jinka[1]} r="11" fill="#c9daee" stroke="#071526" strokeWidth="4" />
            </g>
            <g className="lightmap-dot lightmap-dot--bodi">
              <circle cx={P.bodi[0]} cy={P.bodi[1]} r="13" fill="#f0c977" stroke="#071526" strokeWidth="4" />
            </g>
            <g className="lightmap-dot lightmap-dot--luqa">
              <circle cx={P.luqa[0]} cy={P.luqa[1]} r="17" fill="#ffe39a" stroke="#071526" strokeWidth="5" />
              <path
                d={`M${P.luqa[0]} ${P.luqa[1] - 9} l9 8 v9 h-18 v-9 z`}
                fill="#b9781a"
              />
            </g>
          </svg>
          <div className="lightmap__dark" aria-hidden="true" />
          <span className="lightmap__label lightmap__label--river" style={pct([250, 610])} aria-hidden="true">
            {labels.river}
          </span>
          <span className="lightmap__label lightmap__label--jinka" style={pct(P.jinka)} aria-hidden="true">
            {labels.jinka}
          </span>
          <span className="lightmap__label lightmap__label--bodi" style={pct(P.bodi)} aria-hidden="true">
            {labels.bodi}
          </span>
          <span className="lightmap__label lightmap__label--luqa" style={pct(P.luqa)} aria-hidden="true">
            {labels.luqa}
          </span>
          <span className="lightmap__label lightmap__label--km" style={pct([620, 610])} aria-hidden="true">
            {labels.distance}
          </span>
          <span className="lightmap__note">{labels.note}</span>
        </div>
      </div>
    </section>
  );
}
