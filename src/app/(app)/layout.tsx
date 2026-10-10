import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/access";
import { logoutAction } from "@/app/actions/auth";
import { OrgSwitcher } from "@/components/org-switcher";
import { Logo } from "@/components/logo";
import { initials } from "@/lib/utils";
import { savedTheme } from "@/lib/theme-server";
import { ThemeSwitch } from "@/components/theme-switch";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/en";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, memberships, org, role } = await getContext();
  // Story 7: everyone agrees to the Privacy notice once before using the app.
  if (!user.consentAt) redirect("/consent");
  const [theme, t] = await Promise.all([savedTheme(), getT()]);
  const nav: { href: string; label: string }[] = [{ href: "/dashboard", label: t("nav.dashboard") }];
  if (role === "ADMIN" || role === "INSTRUCTOR") nav.push({ href: "/cohorts", label: t("nav.cohorts") }, { href: "/insights", label: t("nav.insights") }, { href: "/labs", label: t("nav.labs") });
  if (role === "ADMIN") nav.push({ href: "/admin/members", label: t("nav.people") });
  if (org) nav.push({ href: "/tracks", label: t("nav.tracks") });
  if (user.isSuperAdmin) nav.push({ href: "/platform", label: t("nav.schools") });

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b print:hidden border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/dashboard" className="shrink-0"><Logo size={32} product="Tracks" /></Link>
          <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto" aria-label={t("nav.main")}>
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-surface-sunken hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          {memberships.length > 1 && (
            <div className="hidden sm:block"><OrgSwitcher orgs={memberships.map((m) => m.org)} current={org?.id} /></div>
          )}
          <div className="hidden shrink-0 xl:block"><ThemeSwitch initial={theme} /></div>
          <details className="relative">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary" aria-label={t("account.menu")}>
              {initials(user.name, user.email)}
            </summary>
            <div className="card absolute end-0 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] p-3 shadow-[var(--shadow-popover)]">
              <div className="truncate text-sm font-semibold">{user.name ?? "—"}</div>
              <div className="truncate text-xs text-ink-muted" lang="en" dir="ltr">{user.email}</div>
              {org && <div className="mt-2 text-xs text-ink-muted">{org.name}{role ? ` · ${t(`role.${role}` as MessageKey)}` : ""}</div>}
              {memberships.length > 1 && (
                <div className="mt-3 sm:hidden"><OrgSwitcher orgs={memberships.map((m) => m.org)} current={org?.id} /></div>
              )}
              <div className="mt-3 xl:hidden"><ThemeSwitch initial={theme} /></div>
              <Link href="/join" className="mt-3 block text-sm text-primary">{t("account.join")}</Link>
              <Link href="/privacy" className="mt-2 block text-sm text-primary">{t("account.privacy")}</Link>
              <form action={logoutAction} className="mt-3"><button className="btn-ghost w-full">{t("account.signOut")}</button></form>
            </div>
          </details>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
