import Link from "next/link";
import { pct } from "@/lib/utils";

export function Logo({ small = false }: { small?: boolean }) {
  // "Book of dawn": an open book with the sun rising from its pages.
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className={small ? "h-6 w-6" : "h-8 w-8"} aria-hidden>
        <circle cx="16" cy="13" r="6" fill="var(--saffron)" />
        <path d="M3 14c5-1.5 9-0.5 13 2.5 4-3 8-4 13-2.5v12c-5-1.5-9-0.5-13 2.5-4-3-8-4-13-2.5z" fill="var(--forest)" />
        <path d="M16 16.5v12" stroke="var(--bg)" strokeWidth="1.2" />
      </svg>
      <span className={`font-serif font-semibold text-text ${small ? "text-base" : "text-lg"}`}>
        NoorAI <span className="text-forest">Tracks</span>
      </span>
    </span>
  );
}

export function ProgressBar({ value, expected, tone = "forest" }: { value: number; expected?: number; tone?: "forest" | "saffron" }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${tone === "forest" ? "bg-forest" : "bg-saffron"}`} style={{ width: pct(value) }} />
      {expected !== undefined && expected > 0 && (
        <div className="absolute top-0 h-full w-0.5 bg-text/50" style={{ left: pct(expected) }} title={`Expected by now: ${pct(expected)}`} />
      )}
    </div>
  );
}

const LEVEL_STYLE: Record<string, string> = {
  Foundation: "bg-forest-tint text-forest",
  Intermediate: "bg-saffron-tint text-text",
  Advanced: "bg-sky-tint text-sky",
  Expert: "bg-forest text-on-forest",
};
export function LevelPill({ level }: { level: string }) {
  if (!level) return null;
  return <span className={`pill ${LEVEL_STYLE[level] ?? "bg-surface-2 text-muted"}`}>{level}</span>;
}

const KIND_STYLE: Record<string, string> = {
  PROJECT: "bg-saffron-tint text-text",
  DELIVERABLE: "bg-saffron-tint text-text",
  MILESTONE: "bg-forest text-on-forest",
};
export function KindPill({ kind }: { kind: string }) {
  if (kind === "LESSON") return null;
  return <span className={`pill ${KIND_STYLE[kind]}`}>{kind.toLowerCase()}</span>;
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (status === "VERIFIED") return <span className="pill bg-forest-tint text-forest">✓ verified</span>;
  if (status === "NEEDS_WORK") return <span className="pill bg-danger-tint text-danger">needs work</span>;
  if (status === "DONE") return <span className="pill bg-surface-2 text-muted">done</span>;
  return null;
}

export function RiskPill({ risk }: { risk: "inactive" | "behind" | null }) {
  if (risk === "inactive") return <span className="pill bg-danger-tint text-danger">inactive 14+ days</span>;
  if (risk === "behind") return <span className="pill bg-saffron-tint text-text">behind pace</span>;
  return <span className="pill bg-forest-tint text-forest">on track</span>;
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-serif text-2xl text-text">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, back, actions }: { title: string; sub?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {back && <Link href={back.href} className="mb-2 inline-block text-sm text-muted hover:text-text">← {back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">{title}</h1>
          {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <div className="font-serif text-lg text-text">{title}</div>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger" role="alert">{message}</p>;
}
