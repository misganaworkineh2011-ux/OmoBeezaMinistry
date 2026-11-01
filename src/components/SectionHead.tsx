import type { ReactNode } from "react";
import Reveal from "@/components/Reveal";

interface SectionHeadProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  /** Light text for dark sections. */
  light?: boolean;
  /** Optional element (e.g. a button) placed opposite the heading. */
  aside?: ReactNode;
  as?: "h1" | "h2";
}

export default function SectionHead({ eyebrow, title, lead, align = "left", light, aside, as: H = "h2" }: SectionHeadProps) {
  const eyebrowClass = `eyebrow${light ? " eyebrow--light" : ""}${align === "center" ? " eyebrow--center" : ""}`;
  const body = (
    <div>
      {eyebrow ? <span className={eyebrowClass}>{eyebrow}</span> : null}
      <H className="title-lg">{title}</H>
      {lead ? <p className="lead">{lead}</p> : null}
    </div>
  );

  if (aside) {
    return (
      <Reveal className="section-head section-head--split">
        {body}
        {aside}
      </Reveal>
    );
  }

  return <Reveal className={`section-head${align === "center" ? " section-head--center" : ""}`}>{body}</Reveal>;
}
