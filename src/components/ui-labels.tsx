"use client";

import { Badge, Tag } from "@/components/badge";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/en";
import { pct } from "@/lib/utils";

// Small labels used on server and client pages alike, in the person's language (feature 5).

export function ProgressBar({ value, expected, tone = "forest", label }: { value: number; expected?: number; tone?: "forest" | "saffron"; label?: string }) {
  const t = useT();
  const text = expected !== undefined && expected > 0 ? t("bar.planExpects", { value: pct(value), expected: pct(expected) }) : pct(value);
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-label={label} aria-valuetext={text}
      aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${tone === "forest" ? "bg-primary" : "bg-highlight"}`} style={{ width: pct(value) }} />
      {expected !== undefined && expected > 0 && (
        // insetInlineStart: from the left in English, from the right in Urdu, like the bar itself.
        <div className="absolute top-0 h-full w-0.5 bg-ink/50" style={{ insetInlineStart: pct(expected) }} title={t("bar.expectedBy", { expected: pct(expected) })} />
      )}
    </div>
  );
}

export function KindPill({ kind }: { kind: string }) {
  const t = useT();
  if (kind === "LESSON") return null;
  return <Tag strong={kind === "MILESTONE"}>{t(`kind.${kind}` as MessageKey)}</Tag>;
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  const t = useT();
  if (status === "VERIFIED") return <Badge tone="success" icon="online">{t("status.verified")}</Badge>;
  if (status === "NEEDS_WORK") return <Badge tone="danger" icon="error">{t("status.needsWork")}</Badge>;
  if (status === "DONE") return <Badge tone="neutral" icon="check">{t("status.done")}</Badge>;
  return null;
}

/** A stage sign-off: passed, not passed yet, or nothing. */
export function SignoffBadge({ passed, notYet }: { passed: boolean | null | undefined; notYet?: string }) {
  const t = useT();
  if (passed === true) return <Badge tone="success" icon="online">{t("status.signedOff")}</Badge>;
  if (passed === false) return <Badge tone="danger" icon="x">{notYet ?? t("status.notPassed")}</Badge>;
  return null;
}

export function RiskPill({ risk }: { risk: "inactive" | "behind" | null }) {
  const t = useT();
  if (risk === "inactive") return <Badge tone="danger" icon="error">{t("status.inactive")}</Badge>;
  if (risk === "behind") return <Badge tone="warning" icon="offline">{t("status.behindPace")}</Badge>;
  return <Badge tone="success" icon="check">{t("status.onTrack")}</Badge>;
}

/** Paused, completed or withdrawn (active students show their RiskPill instead). */
export function EnrollmentBadge({ status }: { status: string }) {
  const t = useT();
  if (status === "COMPLETED") return <Badge tone="success" icon="star">{t("status.completed")}</Badge>;
  if (status === "PAUSED") return <Badge tone="neutral" icon="clock">{t("status.paused")}</Badge>;
  if (status === "WITHDRAWN") return <Badge tone="neutral" icon="minus">{t("status.withdrawn")}</Badge>;
  return <Badge tone="success" icon="check">{t("status.active")}</Badge>;
}
