import "server-only";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { buildRegister, shiftMonth } from "@/lib/attendance-core";

// Attendance (register story): loading what the rules in attendance-core.ts need.

/** The cohort's register for a month: every student still in the cohort (active or paused), plus anyone
 *  who has a mark that month (e.g. withdrawn later), so a printed register never loses a row. */
export async function loadRegister(cohortId: string, month: string) {
  const people = await db.select({ enrollmentId: schema.enrollments.id, status: schema.enrollments.status, name: schema.users.name, email: schema.users.email })
    .from(schema.enrollments).innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
    .where(eq(schema.enrollments.cohortId, cohortId)).orderBy(asc(schema.users.name));
  const records = people.length
    ? await db.select({ enrollmentId: schema.attendance.enrollmentId, date: schema.attendance.date, present: schema.attendance.present })
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
