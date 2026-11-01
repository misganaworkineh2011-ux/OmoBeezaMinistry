"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export default function Shell({
  groups,
  user,
  logout,
  children,
}: {
  groups: NavGroup[];
  user: { name: string; email: string };
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className={`shell${open ? " is-open" : ""}`}>
      <aside className="sidebar" aria-label="Dashboard navigation">
        <Link href="/admin" className="sidebar__brand">
          <img src="/img/emblem.png" alt="" />
          <span>
            <strong>Omo Beeza</strong>
            <span>Dashboard</span>
          </span>
        </Link>
        {groups.map((group, i) => (
          <div key={group.title ?? i}>
            {group.title ? <p className="sidebar__group">{group.title}</p> : null}
            <nav>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                  <Icon name={item.icon} />
                  {item.label}
                  {item.badge ? <span className="sidebar__badge">{item.badge}</span> : null}
                </Link>
              ))}
            </nav>
          </div>
        ))}
        <div className="sidebar__foot">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
          <div className="btn-group" style={{ marginTop: 10 }}>
            <a className="a-btn a-btn--ghost a-btn--sm" href="/" target="_blank" rel="noopener">
              <Icon name="globe" /> View site
            </a>
            <form action={logout}>
              <button className="a-btn a-btn--ghost a-btn--sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div>
        <div className="topbar-mobile">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <strong>Omo Beeza Dashboard</strong>
        </div>
        <main className="main" onClick={() => open && setOpen(false)}>
          {children}
        </main>
      </div>
    </div>
  );
}
