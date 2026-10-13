import Link from "next/link";

/** A row of links that filter a page, e.g. All · Morning Boys · Evening Girls, or All · Hostel · Day scholars. */
export function FilterChips({ label, options, current }: { label: string; options: { href: string; label: string; value: string | null }[]; current: string | null }) {
  return (
    <nav aria-label={label} className="mb-4 flex flex-wrap items-center gap-1 text-sm">
      <span className="me-1 text-ink-muted">{label}:</span>
      {options.map((o) => {
        const on = o.value === current;
        return (
          <Link key={o.value ?? "all"} href={o.href} aria-current={on ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${on ? "border-primary bg-primary-soft font-semibold text-ink" : "border-border text-ink-muted hover:bg-surface-sunken"}`}>
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The group filter's options for a page: All, each group, and "No group" when some classes have none. */
export function groupOptions(groups: { id: string; name: string }[], href: (group: string | null) => string, anyWithout: boolean) {
  return [
    { value: null, label: "All", href: href(null) },
    ...groups.map((g) => ({ value: g.id, label: g.name, href: href(g.id) })),
    ...(anyWithout && groups.length ? [{ value: "none", label: "No group", href: href("none") }] : []),
  ];
}
