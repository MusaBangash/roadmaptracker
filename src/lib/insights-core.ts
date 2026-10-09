// Insights (feature 4): school charts maths, pure and tested (insights-core.test.ts).
// Data loading is in src/lib/insights.ts; the page is /insights.
import { currentStageIndex, expectedPct, summarizeCells, type Cell, type CoreStage, type Summary } from "@/lib/progress-core";

export const RANGES = { "4": "Last 4 weeks", "12": "Last 12 weeks", all: "Since the start" } as const;
export type Range = keyof typeof RANGES;
export const parseRange = (v?: string | null): Range => (v === "4" || v === "all" ? v : "12");
/** "Since the start" never draws more than two years of weeks. */
export const MAX_WEEKS = 104;

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => iso(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY));

/** Monday (UTC) of the week a moment falls in, as YYYY-MM-DD (the same as Postgres date_trunc('week')). */
export function mondayOf(d: Date) {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return iso(day);
}

/** The Mondays to show, oldest first, ending with this week. */
export function weeksFor(range: Range, earliest: Date | null, now = new Date()): string[] {
  const last = mondayOf(now);
  let count = range === "all" ? (earliest ? Math.floor((Date.parse(last) - Date.parse(mondayOf(earliest))) / (7 * DAY)) + 1 : 12) : Number(range);
  count = Math.max(1, Math.min(MAX_WEEKS, count));
  return Array.from({ length: count }, (_, i) => addDays(last, (i - count + 1) * 7));
}

/** A student's progress cells, each with the Monday of the week the items were ticked. */
export type DatedCell = Cell & { week: string };

/**
 * One student's progress % at the end of each week: everything ticked up to then, counted with the
 * same rules as today's progress (summarizeCells). Work that is now "needs work" was never counted.
 */
export function progressByWeek(tree: CoreStage[], cells: DatedCell[], weeks: string[]): number[] {
  const sorted = [...cells].sort((a, b) => a.week.localeCompare(b.week));
  const running = new Map<string, Cell>();
  let i = 0;
  return weeks.map((w) => {
    for (; i < sorted.length && sorted[i].week <= w; i++) {
      const c = sorted[i];
      const k = `${c.stageId}|${c.group ?? ""}|${c.kind}`;
      const prev = running.get(k);
      running.set(k, prev ? { ...prev, done: prev.done + c.done, verified: prev.verified + c.verified } : { stageId: c.stageId, group: c.group, kind: c.kind, done: c.done, verified: c.verified });
    }
    return summarizeCells(tree, [...running.values()], []).pct;
  });
}

export type HistoryPoint = { week: string; avg: number | null; expected: number | null };

/**
 * Story 2: a cohort's average progress and the plan's position at the end of each week.
 * Weeks before the cohort started, or with no students, have no point (null).
 */
export function cohortHistory(tree: CoreStage[], students: DatedCell[][], weeks: string[], startDate: Date, now = new Date()): HistoryPoint[] {
  const perStudent = students.map((cells) => progressByWeek(tree, cells, weeks));
  return weeks.map((week, wi) => {
    const end = new Date(Math.min(Date.parse(`${addDays(week, 7)}T00:00:00Z`), now.getTime()));
    if (end <= startDate) return { week, avg: null, expected: null };
    const avg = perStudent.length ? perStudent.reduce((a, s) => a + s[wi], 0) / perStudent.length : null;
    return { week, avg, expected: expectedPct(tree, startDate, end) };
  });
}

/** Ahead of / on / behind the plan, in words (charts never rely on colour alone). */
export function paceWord(avg: number | null, expected: number | null) {
  if (avg === null || expected === null) return null;
  if (avg + 0.05 < expected) return "Behind the plan";
  if (avg > expected + 0.05) return "Ahead of the plan";
  return "On the plan";
}

/** Story 4: how many students are on each stage now ("You are here"), and how many finished. */
export function stageCounts(tree: CoreStage[], summaries: Summary[]) {
  const counts = tree.map(() => 0);
  let finished = 0;
  for (const s of summaries) {
    const i = currentStageIndex(tree, s);
    if (i < 0) finished++;
    else counts[i]++;
  }
  return { counts, finished };
}

export type ReviewWeek = { week: string; submitted: number; verified: number; sentBack: number };

/** Story 5: per week, pieces of work submitted, and decisions (verified / sent back). */
export function reviewWeeks(weeks: string[], submitted: Date[], decisions: { at: Date; verified: boolean }[]): ReviewWeek[] {
  const rows = new Map(weeks.map((w) => [w, { week: w, submitted: 0, verified: 0, sentBack: 0 }]));
  for (const d of submitted) { const r = rows.get(mondayOf(d)); if (r) r.submitted++; }
  for (const d of decisions) { const r = rows.get(mondayOf(d.at)); if (r) { if (d.verified) r.verified++; else r.sentBack++; } }
  return [...rows.values()];
}

/** Average days work waited for a decision (one decimal); waits below zero (clock problems) are left out. */
export function averageWait(days: (number | null)[]) {
  const ok = days.filter((d): d is number => d !== null && Number.isFinite(d) && d >= 0);
  return ok.length ? Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 10) / 10 : null;
}

/** "3 Aug" for chart labels. */
export function weekLabel(week: string) {
  return new Date(`${week}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
