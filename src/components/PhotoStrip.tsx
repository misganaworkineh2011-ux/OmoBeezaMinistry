import Image from "next/image";
import type { Photo } from "@/lib/galleries";

/** Endless, gently tilted ribbon of polaroid photos. Decorative. */
export default function PhotoStrip({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null;
  const row = (hidden: boolean) => (
    <div className="strip__row" aria-hidden={hidden || undefined}>
      {photos.map((p, i) => (
        <span key={`${p.src}-${i}`} className="strip__item" style={{ ["--r" as string]: `${((i * 53) % 9) - 4}deg` }}>
          <span className="strip__photo">
            <Image src={p.src} alt="" fill sizes="220px" />
          </span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="strip" aria-hidden="true">
      <div className="strip__track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
