import Link from "next/link";
import { pct } from "@/lib/utils";
import { Icon, type IconName } from "@/components/icon";

export function ProgressBar({ value, expected, tone = "forest", label }: { value: number; expected?: number; tone?: "forest" | "saffron"; label?: string }) {
  const text = expected !== undefined && expected > 0 ? `${pct(value)}, plan expects ${pct(expected)}` : pct(value);
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-label={label} aria-valuetext={text}
      aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${tone === "forest" ? "bg-primary" : "bg-highlight"}`} style={{ width: pct(value) }} />
      {expected !== undefined && expected > 0 && (
        <div className="absolute top-0 h-full w-0.5 bg-ink/50" style={{ left: pct(expected) }} title={`Expected by now: ${pct(expected)}`} />
      )}
    </div>
  );
}

/** "needs_work" → "Needs work": sentence case for words stored in capitals. */
export function sentence(s: string) {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Tone = "success" | "warning" | "danger" | "info" | "neutral";
const TONE: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-sunken text-ink-muted",
};

/** A status: always an icon and a word, never colour alone (like Lab Studio's StatusBadge). */
export function Badge({ tone, icon, children }: { tone: Tone; icon: IconName; children: React.ReactNode }) {
  return (
    <span className={`badge ${TONE[tone]}`}>
      <Icon name={icon} size={14} />
      {children}
    </span>
  );
}

/** A label that is not a status (level, kind, role, "optional"). */
export function Tag({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={`pill ${strong ? "bg-primary text-on-primary" : "bg-surface-sunken text-ink-muted"}`}>{children}</span>;
}

export function LevelPill({ level }: { level: string }) {
  if (!level) return null;
  return <Tag strong={level === "Expert"}>{level}</Tag>;
}

export function KindPill({ kind }: { kind: string }) {
  if (kind === "LESSON") return null;
  return <Tag strong={kind === "MILESTONE"}>{sentence(kind)}</Tag>;
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (status === "VERIFIED") return <Badge tone="success" icon="online">Verified</Badge>;
  if (status === "NEEDS_WORK") return <Badge tone="danger" icon="error">Needs work</Badge>;
  if (status === "DONE") return <Badge tone="neutral" icon="check">Done</Badge>;
  return null;
}

/** A stage sign-off: passed, not passed yet, or nothing. */
export function SignoffBadge({ passed, notYet = "Not passed yet" }: { passed: boolean | null | undefined; notYet?: string }) {
  if (passed === true) return <Badge tone="success" icon="online">Signed off</Badge>;
  if (passed === false) return <Badge tone="danger" icon="x">{notYet}</Badge>;
  return null;
}

export function RiskPill({ risk }: { risk: "inactive" | "behind" | null }) {
  if (risk === "inactive") return <Badge tone="danger" icon="error">Inactive 14+ days</Badge>;
  if (risk === "behind") return <Badge tone="warning" icon="offline">Behind pace</Badge>;
  return <Badge tone="success" icon="check">On track</Badge>;
}

/** Paused, completed or withdrawn (active students show their RiskPill instead). */
export function EnrollmentBadge({ status }: { status: string }) {
  if (status === "COMPLETED") return <Badge tone="success" icon="star">Completed</Badge>;
  if (status === "PAUSED") return <Badge tone="neutral" icon="clock">Paused</Badge>;
  if (status === "WITHDRAWN") return <Badge tone="neutral" icon="minus">Withdrawn</Badge>;
  return <Badge tone="success" icon="check">Active</Badge>;
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
