import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDate, type PostMeta } from "@/lib/blog";
import Icon from "@/components/Icon";

export default function PostCard({ post, locale }: { post: PostMeta; locale: string }) {
  const t = useTranslations("blog");
  const tc = useTranslations("common");
  const href = `/blog/${post.slug}`;
  return (
    <article className="post-card">
      <Link href={href} className="post-card__media" tabIndex={-1} aria-hidden="true">
        <Image src={post.cover} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 400px" />
      </Link>
      <div className="post-card__body">
        <div className="post-meta">
          <span>
            <Icon name="calendar" /> {formatDate(post.date, locale)}
          </span>
          <span>
            <Icon name="clock" /> {tc("minRead", { minutes: post.readingMinutes })}
          </span>
        </div>
        <h3>
          <Link href={href}>{post.title}</Link>
        </h3>
        <p>{post.excerpt}</p>
        <Link href={href} className="text-link">
          {t("readMore")} <Icon name="arrowRight" />
        </Link>
      </div>
    </article>
  );
}
