// Attendance views (student's own attendance, monthly register), pure and tested in
// attendance-core.test.ts. A "class day" is a day a teacher took attendance for the cohort; days are
// calendar days ("YYYY-MM-DD"), months are "YYYY-MM".

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
export type AttendanceRecord = { enrollmentId: string; date: string; status: AttendanceStatus };
/** Register letters: P present, A absent, L late, Lv leave (permission given). */
export type Mark = "P" | "A" | "L" | "Lv" | null;
export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;
export const MARK_OF: Record<AttendanceStatus, Exclude<Mark, null>> = { PRESENT: "P", ABSENT: "A", LATE: "L", LEAVE: "Lv" };
export const ATTENDANCE_WORDS: Record<AttendanceStatus, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", LEAVE: "Leave" };
/** Late counts as present. */
export const countsPresent = (s: AttendanceStatus) => s === "PRESENT" || s === "LATE";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" from the address, else the fallback (e.g. this month). */
export function parseMonth(input: string | null | undefined, fallback: string) {
  return input && MONTH_RE.test(input) ? input : fallback;
}

export function monthOf(day: string) {
  return day.slice(0, 7);
}

/** The month before (-1) or after (+1). */
export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Every day of the month, "YYYY-MM-DD". */
export function daysOfMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** 0 = Monday … 6 = Sunday (weeks start on Monday, as in the rest of the app). */
export function weekdayOf(day: string) {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * A student's attendance: Late counts as present; Leave (permission given) is left out, so it never
 * lowers the percentage. `total` = days marked, `counted` = days that count (all but Leave).
 */
export function attendanceSummary(records: { status: AttendanceStatus }[]) {
  const n = (s: AttendanceStatus) => records.filter((r) => r.status === s).length;
  const late = n("LATE"), leave = n("LEAVE"), absent = n("ABSENT");
  const present = n("PRESENT") + late;
  const counted = records.length - leave;
  return { present, late, absent, leave, total: records.length, counted, pct: counted ? present / counted : null };
}

/**
 * The monthly register: the cohort's class days of the month as columns, one row per student with
 * P/A/L/Lv per day (blank = no mark that day, e.g. joined later) and their totals, and the totals per day.
 */
export function buildRegister(students: { enrollmentId: string; name: string }[], records: AttendanceRecord[], month: string) {
  const inMonth = records.filter((r) => monthOf(r.date) === month);
  const days = [...new Set(inMonth.map((r) => r.date))].sort();
  const mark = new Map(inMonth.map((r) => [`${r.enrollmentId}|${r.date}`, r.status]));
  const rows = students.map((s) => {
    const statuses = days.map((d) => mark.get(`${s.enrollmentId}|${d}`) ?? null);
    const cells: Mark[] = statuses.map((st) => (st ? MARK_OF[st] : null));
    return { ...s, cells, ...attendanceSummary(statuses.filter((st): st is AttendanceStatus => st !== null).map((status) => ({ status }))) };
  });
  const perDay = days.map((_, i) => {
    const col = rows.map((r) => r.cells[i]);
    const c = (m: Mark) => col.filter((x) => x === m).length;
    return { present: c("P") + c("L"), absent: c("A"), late: c("L"), leave: c("Lv") };
  });
  return { days, rows, perDay, presentPerDay: perDay.map((d) => d.present) };
}

// ---------- Warnings ----------

export const ATTENDANCE_LIMITS = { streak: 3, lowPct: 0.75, minDays: 4 } as const;

/** Absences in a row at the end (most recent class days, oldest first in the list); Leave days are skipped. */
export function absentStreak(statusesByDate: AttendanceStatus[]) {
  let n = 0;
  for (let i = statusesByDate.length - 1; i >= 0; i--) {
    const s = statusesByDate[i];
    if (s === "LEAVE") continue;
    if (s !== "ABSENT") break;
    n++;
  }
  return n;
}

export type AttendanceFlag = { kind: "streak"; days: number } | { kind: "low"; pct: number } | null;

/** A warning when a student keeps missing class: 3+ absences in a row, or below 75% once 4+ class days count. */
export function attendanceFlag(statusesByDate: AttendanceStatus[]): AttendanceFlag {
  const streak = absentStreak(statusesByDate);
  if (streak >= ATTENDANCE_LIMITS.streak) return { kind: "streak", days: streak };
  const sum = attendanceSummary(statusesByDate.map((status) => ({ status })));
  if (sum.pct !== null && sum.counted >= ATTENDANCE_LIMITS.minDays && sum.pct < ATTENDANCE_LIMITS.lowPct) return { kind: "low", pct: sum.pct };
  return null;
}

export function flagWords(f: Exclude<AttendanceFlag, null>) {
  return f.kind === "streak" ? `Absent ${f.days} class days in a row` : `Attendance ${Math.round(f.pct * 100)}%`;
}

// ---------- Class days ----------

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Weekday numbers from a form (0 = Monday … 6 = Sunday), sorted, without repeats or junk. */
export function parseClassDays(values: unknown[]) {
  return [...new Set(values.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
}

/** "Mon–Thu", "Mon, Wed, Fri", "Every day", or null when not set. */
export function classDaysLabel(days: number[] | null | undefined) {
  if (!days?.length) return null;
  if (days.length === 7) return "Every day";
  const run = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  if (run && days.length >= 3) return `${WEEKDAY_SHORT[days[0]]}–${WEEKDAY_SHORT[days[days.length - 1]]}`;
  return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

export function isClassDay(days: number[] | null | undefined, day: string) {
  return !!days?.includes(weekdayOf(day));
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Class days before today (last 30 days, not before the cohort started) with no attendance saved, newest first. */
export function missedClassDays(days: number[] | null | undefined, taken: Set<string>, start: string, today: string, lookback = 30) {
  if (!days?.length) return [];
  const out: string[] = [];
  for (let i = 1; i <= lookback; i++) {
    const d = addDays(today, -i);
    if (d < start) break;
    if (isClassDay(days, d) && !taken.has(d)) out.push(d);
  }
  return out;
}

/** Reminders start when both the cohort has started and its class days were set. */
export function remindFrom(cohortStart: string, classDaysSince: string | null) {
  return classDaysSince && classDaysSince > cohortStart ? classDaysSince : cohortStart;
}

/** "Mon 13 Oct 2026". */
export function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return `${WEEKDAY_SHORT[weekdayOf(day)]} ${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

/** The months that have class days, newest first (for "jump to" links). */
export function monthsWithRecords(records: { date: string }[]) {
  return [...new Set(records.map((r) => monthOf(r.date)))].sort().reverse();
}
