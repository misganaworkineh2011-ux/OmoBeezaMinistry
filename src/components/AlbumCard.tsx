import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Photo } from "@/lib/galleries";
import Icon from "@/components/Icon";

interface AlbumCardProps {
  href: string;
  title: string;
  tag: string;
  descr: string;
  meta: string;
  cta: string;
  /** Up to three cover photos, shown as a stack that fans out on hover. */
  covers: Photo[];
  icon: string;
  featured?: boolean;
}

export default function AlbumCard({ href, title, tag, descr, meta, cta, covers, icon, featured }: AlbumCardProps) {
  const stack = covers.slice(0, 3);
  return (
    <Link href={href} className={`album${featured ? " album--featured" : ""}`}>
      <div className="album__stack" aria-hidden="true">
        {stack.length > 0 ? (
          stack.map((p, i) => (
            <span key={p.src} className={`album__photo album__photo--${i + 1}`}>
              <Image src={p.src} alt="" fill sizes={featured ? "320px" : "260px"} />
            </span>
          ))
        ) : (
          <>
            <span className="album__photo album__photo--1 album__photo--empty" />
            <span className="album__photo album__photo--2 album__photo--empty" />
            <span className="album__photo album__photo--3 album__photo--empty">
              <Icon name={icon} />
            </span>
          </>
        )}
      </div>
      <div className="album__body">
        <span className="album__tag">
          <Icon name={icon} /> {tag}
        </span>
        <h3>{title}</h3>
        <p>{descr}</p>
        <div className="album__foot">
          <span className="album__meta">{meta}</span>
          <span className="text-link">
            {cta} <Icon name="arrowRight" />
          </span>
        </div>
      </div>
    </Link>
  );
}
