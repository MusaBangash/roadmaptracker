import { Icon, type IconName } from "@/components/icon";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";
const TONE: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-sunken text-ink-muted",
};

/** A status: always an icon and a word, never colour alone (like Lab Studio's StatusBadge). */
/** `wrap`: long text may break onto a second line (phones) instead of running off the screen. */
export function Badge({ tone, icon, children, wrap = false }: { tone: Tone; icon: IconName; children: React.ReactNode; wrap?: boolean }) {
  return (
    <span className={`badge ${TONE[tone]}${wrap ? " whitespace-normal" : ""}`}>
      <Icon name={icon} size={14} />
      {children}
    </span>
  );
}

/** A label that is not a status (level, kind, role, "optional"). */
export function Tag({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={`pill ${strong ? "bg-primary text-on-primary" : "bg-surface-sunken text-ink-muted"}`}>{children}</span>;
}

