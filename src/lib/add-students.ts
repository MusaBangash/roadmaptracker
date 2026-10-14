import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { canAddToClass, teacherCanSee, type EnrollmentStatus } from "@/lib/cohort-core";
import type { Residence } from "@/lib/group-core";

// "Add students from the school" (rules in cohort-core.ts): students who already have an account in this
// school and can be put in a class without a link. Used by the page and, to re-check, by the action.

export type Place = { cohortId: string; status: EnrollmentStatus; leftOn: string | null; groupId: string | null };
export type SchoolStudent = { userId: string; name: string | null; email: string | null; residence: Residence | null; here: Place | null; places: Place[] };

type Ctx = { org: { id: string }; user: { id: string }; role: "ADMIN" | "INSTRUCTOR" | "STUDENT" };

/**
 * The students this person may add to the cohort, and the classes they may pick "From class" from.
 * Admins: every student of the school and every class. Teachers: the students of the classes they teach
 * (plus anyone with a place in this one) and those classes. Students already in this class are left out.
 */
export async function addableStudents(ctx: Ctx, cohortId: string) {
  const [members, places, cohorts, taught] = await Promise.all([
    db.select({ userId: schema.users.id, name: schema.users.name, email: schema.users.email, residence: schema.memberships.residence })
      .from(schema.memberships).innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(and(eq(schema.memberships.orgId, ctx.org.id), eq(schema.memberships.role, "STUDENT"))),
    db.select({ userId: schema.enrollments.userId, cohortId: schema.enrollments.cohortId, status: schema.enrollments.status, leftOn: schema.enrollments.leftOn, groupId: schema.cohorts.groupId })
      .from(schema.enrollments).innerJoin(schema.cohorts, eq(schema.cohorts.id, schema.enrollments.cohortId))
      .where(eq(schema.cohorts.orgId, ctx.org.id)),
    db.select({ id: schema.cohorts.id, name: schema.cohorts.name, archived: schema.cohorts.archived, groupId: schema.cohorts.groupId })
      .from(schema.cohorts).where(eq(schema.cohorts.orgId, ctx.org.id)).orderBy(asc(schema.cohorts.archived), asc(schema.cohorts.name)),
    ctx.role === "ADMIN" ? Promise.resolve(null)
      : db.select({ cohortId: schema.cohortInstructors.cohortId }).from(schema.cohortInstructors)
          .where(eq(schema.cohortInstructors.userId, ctx.user.id)).then((r) => new Set(r.map((x) => x.cohortId))),
  ]);

  const byUser = new Map<string, Place[]>();
  for (const p of places) byUser.set(p.userId, [...(byUser.get(p.userId) ?? []), { cohortId: p.cohortId, status: p.status, leftOn: p.leftOn, groupId: p.groupId }]);

  const students: SchoolStudent[] = [];
  for (const m of members) {
    if (m.userId === ctx.user.id) continue;
    const mine = byUser.get(m.userId) ?? [];
    if (taught && !teacherCanSee(mine, taught, cohortId)) continue;
    const here = mine.find((p) => p.cohortId === cohortId) ?? null;
    if (!canAddToClass(here?.status ?? null)) continue;
    students.push({ ...m, residence: m.residence as Residence | null, here, places: mine.filter((p) => p.cohortId !== cohortId) });
  }
  students.sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""));
  const classes = cohorts.filter((c) => c.id !== cohortId && (!taught || taught.has(c.id)));
  return { students, classes };
}
