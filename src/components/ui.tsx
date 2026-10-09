import Link from "next/link";
import { pct } from "@/lib/utils";

export function ProgressBar({ value, expected, tone = "forest" }: { value: number; expected?: number; tone?: "forest" | "saffron" }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${tone === "forest" ? "bg-primary" : "bg-highlight"}`} style={{ width: pct(value) }} />
      {expected !== undefined && expected > 0 && (
        <div className="absolute top-0 h-full w-0.5 bg-ink/50" style={{ left: pct(expected) }} title={`Expected by now: ${pct(expected)}`} />
      )}
    </div>
  );
}

const LEVEL_STYLE: Record<string, string> = {
  Foundation: "bg-primary-soft text-primary",
  Intermediate: "bg-warning-soft text-ink",
  Advanced: "bg-info-soft text-secondary",
  Expert: "bg-primary text-on-primary",
};
export function LevelPill({ level }: { level: string }) {
  if (!level) return null;
  return <span className={`pill ${LEVEL_STYLE[level] ?? "bg-surface-sunken text-ink-muted"}`}>{level}</span>;
}

const KIND_STYLE: Record<string, string> = {
  PROJECT: "bg-warning-soft text-ink",
  DELIVERABLE: "bg-warning-soft text-ink",
  MILESTONE: "bg-primary text-on-primary",
};
export function KindPill({ kind }: { kind: string }) {
  if (kind === "LESSON") return null;
  return <span className={`pill ${KIND_STYLE[kind]}`}>{kind.toLowerCase()}</span>;
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (status === "VERIFIED") return <span className="pill bg-primary-soft text-primary">✓ verified</span>;
  if (status === "NEEDS_WORK") return <span className="pill bg-danger-soft text-danger">needs work</span>;
  if (status === "DONE") return <span className="pill bg-surface-sunken text-ink-muted">done</span>;
  return null;
}

export function RiskPill({ risk }: { risk: "inactive" | "behind" | null }) {
  if (risk === "inactive") return <span className="pill bg-danger-soft text-danger">inactive 14+ days</span>;
  if (risk === "behind") return <span className="pill bg-warning-soft text-ink">behind pace</span>;
  return <span className="pill bg-primary-soft text-primary">on track</span>;
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-1 font-bold text-2xl text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, back, actions }: { title: string; sub?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {back && <Link href={back.href} className="mb-2 inline-block text-sm text-ink-muted hover:text-ink">← {back.label}</Link>}
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
