import Link from "next/link";

// Labels that change with the language live in ui-labels.tsx (client components using useT).
export { Badge, Tag } from "@/components/badge";
import { Tag } from "@/components/badge";
export { ProgressBar, KindPill, StatusPill, SignoffBadge, RiskPill, EnrollmentBadge } from "@/components/ui-labels";

/** "needs_work" → "Needs work": sentence case for words stored in capitals. */
export function sentence(s: string) {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function LevelPill({ level }: { level: string }) {
  if (!level) return null;
  return <Tag strong={level === "Expert"}>{level}</Tag>;
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold text-ink-muted">{label}</div>
      <div className="mt-1 font-bold text-2xl text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, back, actions }: { title: string; sub?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {back && <Link href={back.href} className="mb-2 inline-block text-sm text-ink-muted hover:text-ink"><span aria-hidden className="inline-block rtl:-scale-x-100">←</span> {back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">{title}</h1>
          {sub && <div className="mt-1 text-sm text-ink-muted">{sub}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <div className="font-bold text-lg text-ink">{title}</div>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{children}</div>}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{message}</p>;
}
