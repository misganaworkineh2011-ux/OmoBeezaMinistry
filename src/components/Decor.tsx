import Icon from "@/components/Icon";

// Decorative building blocks of the visual language. They echo the ministry's
// own imagery: the waves of the logo, the painted triangles of the Home Center
// walls, and a seal like the logo's circle.

/**
 * Organic wave divider between two sections (the logo's water lines).
 * `from` is the color above, `to` the color below.
 */
export function Wave({ from, to, flip = false }: { from: string; to: string; flip?: boolean }) {
  return (
    <div className={`wave${flip ? " wave--flip" : ""}`} style={{ background: to }} aria-hidden="true">
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
        <path
          d="M0,0H1440V30C1320,58 1180,68 1020,48C860,28 760,6 600,20C440,34 300,66 140,54C80,50 30,42 0,34Z"
          fill={from}
        />
        <path
          d="M0,46C30,54 80,62 140,66C300,78 440,46 600,32C760,18 860,40 1020,60C1180,80 1320,70 1440,42"
          fill="none"
          stroke="var(--gold-500)"
          strokeWidth="2"
          strokeDasharray="2 7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}

/** A band of triangles inspired by the painted walls of the Home Center. */
export function Tibeb({ className }: { className?: string }) {
  return <div className={`tibeb${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}

/** Rotating circular seal with text around a cross. */
export function SpinBadge({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`spin${className ? ` ${className}` : ""}`} aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <defs>
          <path id="spin-circle" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
        </defs>
        <g className="spin__text">
          <text>
            <textPath href="#spin-circle">{text}</textPath>
          </text>
        </g>
      </svg>
      <span className="spin__core">
        <Icon name="cross" />
      </span>
    </div>
  );
}

/** Infinite scrolling ribbon of words. */
export function Marquee({ words }: { words: string[] }) {
  const row = (hidden: boolean) => (
    <div className="marquee__row" aria-hidden={hidden || undefined}>
      {words.map((w) => (
        <span className="marquee__item" key={w}>
          {w}
          <Icon name="sparkles" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="marquee-wrap">
      <div className="marquee">
        <div className="marquee__track">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}

/** Hand-drawn curved arrow used with script notes. */
export function DoodleArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 90 60" fill="none" aria-hidden="true">
      <path d="M4 6C30 4 62 14 74 44" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M62 38L75 47L80 32" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
