import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Residence } from "@/lib/group-core";

// Loading class groups and Hostel / Day scholar marks (rules in group-core.ts).

/** The school's class groups, oldest first (the order the admin added them). */
export function loadGroups(orgId: string) {
  return db.select({ id: schema.classGroups.id, name: schema.classGroups.name }).from(schema.classGroups)
    .where(eq(schema.classGroups.orgId, orgId)).orderBy(asc(schema.classGroups.createdAt), asc(schema.classGroups.name));
}

/** Each person's Hostel / Day scholar mark in this school (missing = not set). */
export async function residences(orgId: string, userIds: string[]) {
  if (!userIds.length) return new Map<string, Residence>();
  const rows = await db.select({ userId: schema.memberships.userId, residence: schema.memberships.residence }).from(schema.memberships)
    .where(and(eq(schema.memberships.orgId, orgId), inArray(schema.memberships.userId, userIds)));
  return new Map(rows.filter((r) => r.residence).map((r) => [r.userId, r.residence as Residence]));
}

/**
 * The hostel list for one day: in these cohorts, every hostel student on the attendance list (active or
 * paused) with their mark that day (null = not taken yet).
 */
export async function hostelDay(orgId: string, cohortIds: string[], date: string) {
  if (!cohortIds.length) return [];
  const rows = await db.select({
    enrollmentId: schema.enrollments.id, cohortId: schema.cohorts.id, cohort: schema.cohorts.name,
    name: schema.users.name, email: schema.users.email,
  }).from(schema.enrollments)
    .innerJoin(schema.cohorts, eq(schema.cohorts.id, schema.enrollments.cohortId))
    .innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
    .innerJoin(schema.memberships, and(eq(schema.memberships.userId, schema.enrollments.userId), eq(schema.memberships.orgId, orgId)))
    .where(and(inArray(schema.enrollments.cohortId, cohortIds), inArray(schema.enrollments.status, ["ACTIVE", "PAUSED"]), eq(schema.memberships.residence, "HOSTEL")))
    .orderBy(asc(schema.cohorts.name), asc(schema.users.name));
  const marks = rows.length
    ? await db.select({ e: schema.attendance.enrollmentId, status: schema.attendance.status }).from(schema.attendance)
      .where(and(inArray(schema.attendance.enrollmentId, rows.map((r) => r.enrollmentId)), eq(schema.attendance.date, date)))
    : [];
  const mark = new Map(marks.map((m) => [m.e, m.status]));
  return rows.map((r) => ({ ...r, name: r.name ?? r.email ?? "Student", status: mark.get(r.enrollmentId) ?? null }));
}

/** Today's attendance in these cohorts split by Hostel / Day scholar: present (Late counts) of marked. */
export async function residenceToday(orgId: string, cohortIds: string[], date: string) {
  const out = { HOSTEL: { present: 0, marked: 0 }, DAY: { present: 0, marked: 0 } };
  if (!cohortIds.length) return out;
  const rows = await db.select({ residence: schema.memberships.residence, status: schema.attendance.status })
    .from(schema.attendance)
    .innerJoin(schema.enrollments, eq(schema.enrollments.id, schema.attendance.enrollmentId))
    .innerJoin(schema.memberships, and(eq(schema.memberships.userId, schema.enrollments.userId), eq(schema.memberships.orgId, orgId)))
    .where(and(inArray(schema.enrollments.cohortId, cohortIds), eq(schema.attendance.date, date)));
  for (const r of rows) {
    if (!r.residence) continue;
    out[r.residence].marked++;
    if (r.status === "PRESENT" || r.status === "LATE") out[r.residence].present++;
  }
  return out;
}
