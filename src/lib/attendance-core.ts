// Attendance views (student's own attendance, monthly register), pure and tested in
// attendance-core.test.ts. A "class day" is a day a teacher took attendance for the cohort; days are
// calendar days ("YYYY-MM-DD"), months are "YYYY-MM".

export type AttendanceRecord = { enrollmentId: string; date: string; present: boolean };
export type Mark = "P" | "A" | null;

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

/** Present days, class days and the share present (null before any class day). */
export function attendanceSummary(records: { present: boolean }[]) {
  const total = records.length;
  const present = records.filter((r) => r.present).length;
  return { present, absent: total - present, total, pct: total ? present / total : null };
}

/**
 * The monthly register: the cohort's class days of the month as columns, one row per student with P/A
 * per day (blank = no mark that day, e.g. joined later) and their totals, and the number present per day.
 */
export function buildRegister(students: { enrollmentId: string; name: string }[], records: AttendanceRecord[], month: string) {
  const inMonth = records.filter((r) => monthOf(r.date) === month);
  const days = [...new Set(inMonth.map((r) => r.date))].sort();
  const mark = new Map(inMonth.map((r) => [`${r.enrollmentId}|${r.date}`, r.present]));
  const rows = students.map((s) => {
    const cells: Mark[] = days.map((d) => {
      const v = mark.get(`${s.enrollmentId}|${d}`);
      return v === undefined ? null : v ? "P" : "A";
    });
    return { ...s, cells, ...attendanceSummary(cells.filter((c) => c !== null).map((c) => ({ present: c === "P" }))) };
  });
  const presentPerDay = days.map((_, i) => rows.filter((r) => r.cells[i] === "P").length);
  return { days, rows, presentPerDay };
}

/** The months that have class days, newest first (for "jump to" links). */
export function monthsWithRecords(records: { date: string }[]) {
  return [...new Set(records.map((r) => monthOf(r.date)))].sort().reverse();
}
