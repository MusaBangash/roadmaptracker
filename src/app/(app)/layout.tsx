import Link from "next/link";
import { getContext } from "@/lib/access";
import { logoutAction } from "@/app/actions/auth";
import { OrgSwitcher } from "@/components/org-switcher";
import { Logo } from "@/components/ui";
import { initials } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, memberships, org, role } = await getContext();
  const nav: { href: string; label: string }[] = [{ href: "/dashboard", label: "Dashboard" }];
  if (role === "ADMIN" || role === "INSTRUCTOR") nav.push({ href: "/cohorts", label: "Cohorts" });
  if (role === "ADMIN") nav.push({ href: "/admin/members", label: "People" });
  if (org) nav.push({ href: "/tracks", label: "Tracks" });
  if (user.isSuperAdmin) nav.push({ href: "/platform", label: "Schools" });

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/dashboard" className="shrink-0"><Logo small /></Link>
          <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto" aria-label="Main">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text">
                {n.label}
              </Link>
            ))}
          </nav>
          {memberships.length > 1 && (
            <div className="hidden sm:block"><OrgSwitcher orgs={memberships.map((m) => m.org)} current={org?.id} /></div>
          )}
          <details className="relative">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full bg-forest text-xs font-bold text-on-forest" aria-label="Account">
              {initials(user.name, user.email)}
            </summary>
            <div className="card absolute right-0 mt-2 w-64 p-3 shadow-lg">
              <div className="truncate text-sm font-semibold">{user.name ?? "—"}</div>
              <div className="truncate text-xs text-muted">{user.email}</div>
              {org && <div className="mt-2 text-xs text-muted">{org.name} · {role?.toLowerCase()}</div>}
              {memberships.length > 1 && (
                <div className="mt-3 sm:hidden"><OrgSwitcher orgs={memberships.map((m) => m.org)} current={org?.id} /></div>
              )}
              <Link href="/join" className="mt-3 block text-sm text-forest">Join with a code</Link>
              <form action={logoutAction} className="mt-3"><button className="btn-ghost w-full">Sign out</button></form>
            </div>
          </details>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
