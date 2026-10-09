// Small charts drawn as SVG by the app (no chart package): brand colours through CSS tokens,
// every line or bar also named in words, and every chart has a table next to it (feature 4, story 6).
import { weekLabel } from "@/lib/insights-core";

const W = 320;
const H = 150;
const PAD = { l: 34, r: 8, t: 10, b: 22 };
const x = (i: number, n: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
const y = (v: number, max = 1) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);

function path(values: (number | null)[], max = 1) {
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${x(i, values.length).toFixed(1)},${y(v, max).toFixed(1)}`;
    pen = true;
  });
  return d;
}

function Axes({ weeks, ticks, fmt }: { weeks: string[]; ticks: number[]; fmt: (v: number) => string }) {
  const max = ticks[ticks.length - 1] || 1;
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t, max)} y2={y(t, max)} stroke="var(--border)" strokeWidth={1} />
          <text x={PAD.l - 4} y={y(t, max) + 3} textAnchor="end" fontSize={9} fill="var(--ink-muted)">{fmt(t)}</text>
        </g>
      ))}
      {weeks.length > 0 && <text x={PAD.l} y={H - 6} fontSize={9} fill="var(--ink-muted)">{weekLabel(weeks[0])}</text>}
      {weeks.length > 1 && <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize={9} fill="var(--ink-muted)">{weekLabel(weeks[weeks.length - 1])}</text>}
    </>
  );
}

/** Story 2: a cohort's average progress (solid) against the plan (dashed), week by week. */
export function ProgressLine({ weeks, avg, plan, label }: { weeks: string[]; avg: (number | null)[]; plan: (number | null)[]; label: string }) {
  const lastIdx = avg.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).at(-1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <Axes weeks={weeks} ticks={[0, 0.5, 1]} fmt={(v) => `${Math.round(v * 100)}%`} />
      <path d={path(plan)} fill="none" stroke="var(--ink-muted)" strokeWidth={1.5} strokeDasharray="4 3" />
      <path d={path(avg)} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {lastIdx !== undefined && <circle cx={x(lastIdx, avg.length)} cy={y(avg[lastIdx]!)} r={3.5} fill="var(--primary)" />}
    </svg>
  );
}

export function LineLegend() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      <span className="inline-flex items-center gap-1.5"><svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" stroke="var(--primary)" strokeWidth="2.5" /></svg>Class average (solid)</span>
      <span className="inline-flex items-center gap-1.5"><svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" stroke="var(--ink-muted)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>Where the plan expects them (dashed)</span>
    </p>
  );
}

/** Story 5: per week, work submitted (left bar) and checked (right bar: verified + sent back stacked). */
export function ReviewColumns({ rows, label }: { rows: { week: string; submitted: number; verified: number; sentBack: number }[]; label: string }) {
  const top = Math.max(1, ...rows.map((r) => Math.max(r.submitted, r.verified + r.sentBack)));
  const nice = top <= 4 ? 4 : top <= 10 ? 10 : Math.ceil(top / 10) * 10;
  const slot = (W - PAD.l - PAD.r) / Math.max(1, rows.length);
  const bw = Math.max(1.5, Math.min(10, slot / 2 - 1.5));
  const h = (v: number) => (v / nice) * (H - PAD.t - PAD.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <Axes weeks={[]} ticks={[0, nice / 2, nice]} fmt={(v) => String(v)} />
      {rows.map((r, i) => {
        const cx = PAD.l + slot * i + slot / 2;
        const base = H - PAD.b;
        return (
          <g key={r.week}>
            <rect x={cx - bw - 0.5} y={base - h(r.submitted)} width={bw} height={h(r.submitted)} fill="var(--border-strong)" />
            <rect x={cx + 0.5} y={base - h(r.verified)} width={bw} height={h(r.verified)} fill="var(--primary)" />
            <rect x={cx + 0.5} y={base - h(r.verified) - h(r.sentBack)} width={bw} height={h(r.sentBack)} fill="var(--danger)" />
          </g>
        );
      })}
      {rows.length > 0 && <text x={PAD.l} y={H - 6} fontSize={9} fill="var(--ink-muted)">{weekLabel(rows[0].week)}</text>}
      {rows.length > 1 && <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize={9} fill="var(--ink-muted)">{weekLabel(rows[rows.length - 1].week)}</text>}
    </svg>
  );
}

export function ColumnLegend() {
  const sw = (color: string) => <span className="inline-block h-3 w-3 rounded-sm" style={{ background: `var(${color})` }} aria-hidden="true" />;
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      <span className="inline-flex items-center gap-1.5">{sw("--border-strong")}Submitted (left bar)</span>
      <span className="inline-flex items-center gap-1.5">{sw("--primary")}Verified (right bar, bottom)</span>
      <span className="inline-flex items-center gap-1.5">{sw("--danger")}Sent back (right bar, top)</span>
    </p>
  );
}

/** A chart's data as a table, behind "Show as table" (story 6). */
export function ChartTable({ head, rows, caption }: { head: string[]; rows: (string | number)[][]; caption: string }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-primary">Show as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead><tr className="border-b border-border text-ink-muted">{head.map((h) => <th key={h} scope="col" className="py-1 pr-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0">{r.map((c, j) => <td key={j} className="py-1 pr-3">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}
