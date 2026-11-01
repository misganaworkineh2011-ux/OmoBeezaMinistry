import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { logout } from "@/app/admin/actions/auth";
import Shell, { type NavGroup } from "@/components/admin/Shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const unread = (await queryOne<{ n: number }>("select count(*)::int as n from submissions where status = 'new'"))?.n ?? 0;
  const toReview =
    (await queryOne<{ n: number }>("select count(*)::int as n from chat_conversations where unanswered > 0 and not reviewed"))?.n ?? 0;

  const groups: NavGroup[] = [
    { items: [{ href: "/admin", label: "Overview", icon: "home" }] },
    {
      title: "Content",
      items: [
        { href: "/admin/content", label: "Website text", icon: "book" },
        { href: "/admin/posts", label: "Blog posts", icon: "send" },
        { href: "/admin/settings", label: "Contact & settings", icon: "info" },
      ],
    },
    {
      title: "Media",
      items: [
        { href: "/admin/children", label: "Prayer wall", icon: "handHeart" },
        { href: "/admin/albums", label: "Photo albums", icon: "expand" },
        { href: "/admin/videos", label: "Videos", icon: "film" },
      ],
    },
    {
      title: "Engagement",
      items: [
        { href: "/admin/inbox", label: "Inbox", icon: "mail", badge: unread },
        { href: "/admin/chatbot", label: "Chatbot knowledge", icon: "sparkles" },
        { href: "/admin/conversations", label: "Conversations", icon: "help", badge: toReview },
        { href: "/admin/analytics", label: "Analytics", icon: "trending" },
      ],
    },
    { title: "Team", items: [{ href: "/admin/users", label: "Admins", icon: "users" }] },
  ];

  return (
    <Shell groups={groups} user={{ name: user.name, email: user.email }} logout={logout}>
      {children}
    </Shell>
  );
}
