import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, buildRegister, shiftMonth, type AttendanceStatus } from "@/lib/attendance-core";
import { matchesShow, type Show } from "@/lib/group-core";

// Attendance: loading what the rules in attendance-core.ts need.

/** The cohort's register for a month: every student still in the cohort (active or paused), plus anyone
 *  who has a mark that month (e.g. withdrawn later), so a printed register never loses a row. */
export async function loadRegister(cohortId: string, orgId: string, month: string, show: Show = "all") {
  const all = await db.select({ enrollmentId: schema.enrollments.id, status: schema.enrollments.status, name: schema.users.name, email: schema.users.email, residence: schema.memberships.residence })
    .from(schema.enrollments).innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
    .leftJoin(schema.memberships, and(eq(schema.memberships.userId, schema.enrollments.userId), eq(schema.memberships.orgId, orgId)))
    .where(eq(schema.enrollments.cohortId, cohortId)).orderBy(asc(schema.users.name));
  // Hostel students or day scholars only (when the school has a hostel).
  const people = all.filter((p) => matchesShow(show, p.residence));
  const records = people.length
    ? await db.select({ enrollmentId: schema.attendance.enrollmentId, date: schema.attendance.date, status: schema.attendance.status })
      .from(schema.attendance)
      .where(and(inArray(schema.attendance.enrollmentId, people.map((p) => p.enrollmentId)),
        gte(schema.attendance.date, `${month}-01`), lt(schema.attendance.date, `${shiftMonth(month, 1)}-01`)))
    : [];
  const marked = new Set(records.map((r) => r.enrollmentId));
  const students = people
    .filter((p) => p.status === "ACTIVE" || p.status === "PAUSED" || marked.has(p.enrollmentId))
    .map((p) => ({ enrollmentId: p.enrollmentId, name: p.name ?? p.email ?? "Student" }));
  return buildRegister(students, records, month);
}

/** The months that have any attendance in this cohort, newest first. */
export async function registerMonths(cohortId: string) {
  const rows = await db.selectDistinct({ date: schema.attendance.date }).from(schema.attendance)
    .innerJoin(schema.enrollments, eq(schema.enrollments.id, schema.attendance.enrollmentId))
    .where(eq(schema.enrollments.cohortId, cohortId));
  return [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort().reverse();
}

/** Each student's marks, oldest first (for their percentage and the "keeps missing class" warning). */
export async function marksByStudent(enrollmentIds: string[]) {
  const out = new Map<string, AttendanceStatus[]>();
  if (!enrollmentIds.length) return out;
  const rows = await db.select({ e: schema.attendance.enrollmentId, status: schema.attendance.status }).from(schema.attendance)
    .where(inArray(schema.attendance.enrollmentId, enrollmentIds)).orderBy(asc(schema.attendance.date));
  for (const r of rows) out.set(r.e, [...(out.get(r.e) ?? []), r.status]);
  return out;
}

/** One day on the Attendance page: the students on the list, their mark (if saved) and who saved it, when. */
export async function loadDay(cohortId: string, orgId: string, date: string) {
  const people = await db.select({ enrollmentId: schema.enrollments.id, status: schema.enrollments.status, name: schema.users.name, email: schema.users.email, residence: schema.memberships.residence })
    .from(schema.enrollments).innerJoin(schema.users, eq(schema.enrollments.userId, schema.users.id))
    .leftJoin(schema.memberships, and(eq(schema.memberships.userId, schema.enrollments.userId), eq(schema.memberships.orgId, orgId)))
    .where(and(eq(schema.enrollments.cohortId, cohortId), inArray(schema.enrollments.status, ["ACTIVE", "PAUSED"])))
    .orderBy(asc(schema.users.name));
  const recs = people.length
    ? await db.select({ e: schema.attendance.enrollmentId, status: schema.attendance.status, at: schema.attendance.markedAt, by: schema.users.name })
      .from(schema.attendance).leftJoin(schema.users, eq(schema.users.id, schema.attendance.markedById))
      .where(and(inArray(schema.attendance.enrollmentId, people.map((p) => p.enrollmentId)), eq(schema.attendance.date, date)))
      .orderBy(desc(schema.attendance.markedAt))
    : [];
  const mark = new Map(recs.map((r) => [r.e, r.status]));
  const last = recs.find((r) => r.at);
  return {
    students: people.map((p) => ({ enrollmentId: p.enrollmentId, name: p.name ?? p.email ?? "Student", paused: p.status === "PAUSED", residence: p.residence, status: mark.get(p.enrollmentId) ?? null })),
    saved: recs.length ? { by: last?.by ?? null, at: last?.at ?? null } : null,
  };
}

export type DayCounts = { present: number; absent: number; late: number; leave: number; marked: number };

/**
 * For each cohort, the last 31 days: which days attendance was taken and the counts per day
 * (dashboard "today" line, "attendance not taken" reminders and missed class days).
 */
export async function recentAttendance(cohortIds: string[], today: string) {
  const out = new Map<string, Map<string, DayCounts>>();
  if (!cohortIds.length) return out;
  const rows = await db.select({ c: schema.enrollments.cohortId, date: schema.attendance.date, status: schema.attendance.status, n: sql<number>`count(*)` })
    .from(schema.attendance).innerJoin(schema.enrollments, eq(schema.enrollments.id, schema.attendance.enrollmentId))
    .where(and(inArray(schema.enrollments.cohortId, cohortIds), gte(schema.attendance.date, addDays(today, -31))))
    .groupBy(schema.enrollments.cohortId, schema.attendance.date, schema.attendance.status);
  for (const r of rows) {
    const days = out.get(r.c) ?? new Map<string, DayCounts>();
    const d = days.get(r.date) ?? { present: 0, absent: 0, late: 0, leave: 0, marked: 0 };
    const n = Number(r.n);
    d.marked += n;
    if (r.status === "PRESENT" || r.status === "LATE") d.present += n;
    if (r.status === "ABSENT") d.absent += n;
    if (r.status === "LATE") d.late += n;
    if (r.status === "LEAVE") d.leave += n;
    days.set(r.date, d);
    out.set(r.c, days);
  }
  return out;
}
