"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { useT } from "@/i18n/client";

type NavLink = { href: string; label: string };

/** The page a link belongs to: /cohorts/123 is still Cohorts. */
function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The top menu: every link on one line on a computer (never a scroll bar), the page you are on
 * highlighted; on a phone (or a narrow window with many links) one "Menu" button that opens a list.
 */
export function MainNav({ links }: { links: NavLink[] }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Few links fit from a tablet's width; the full staff menu needs a laptop's.
  const wide = links.length > 4 ? "lg" : "md";

  // Close the phone menu after moving to another page.
  useEffect(() => { setOpen(false); }, [pathname]);

  const linkClass = (href: string) => `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold ${
    isCurrent(pathname, href) ? "bg-primary-soft text-ink" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"}`;

  return (
    <>
      <nav className={`hidden flex-1 justify-end gap-1 ${wide === "lg" ? "lg:flex" : "md:flex"}`} aria-label={t("nav.main")}>
        {links.map((n) => (
          <Link key={n.href} href={n.href} className={linkClass(n.href)} aria-current={isCurrent(pathname, n.href) ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className={`flex flex-1 justify-end ${wide === "lg" ? "lg:hidden" : "md:hidden"}`}>
        {/* Opened before the page finished loading is fine: React takes over the open state. */}
        <details className="w-fit" open={open} onToggle={(e) => setOpen(e.currentTarget.open)} suppressHydrationWarning>
          <summary className="btn-ghost cursor-pointer list-none py-1.5" aria-label={t("nav.main")}>
            <Icon name="menu" size={18} />{t("nav.menu")}
          </summary>
          <nav className="card fixed inset-x-4 top-16 flex flex-col gap-1 p-2 shadow-[var(--shadow-popover)] sm:inset-x-auto sm:end-4 sm:w-64" aria-label={t("nav.main")}>
            {links.map((n) => (
              <Link key={n.href} href={n.href} className={`${linkClass(n.href)} py-2`} aria-current={isCurrent(pathname, n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </>
  );
}
