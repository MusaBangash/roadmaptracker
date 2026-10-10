import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ROOM } from "@/lib/lab-core";

// Lab checks: loading what the pages need (rules in lab-core.ts).

type Ctx = { user: { id: string }; org: { id: string }; role: "ADMIN" | "INSTRUCTOR" | "STUDENT" };

/** The labs this person looks after (admins: every lab of the school), with today's state. */
export async function myLabs(ctx: Ctx, includeArchived = false) {
  const where = and(eq(schema.labs.orgId, ctx.org.id), includeArchived ? undefined : eq(schema.labs.archived, false),
    ctx.role === "ADMIN" ? undefined
      : sql`exists (select 1 from "lab_teacher" where "lab_teacher"."lab_id" = "lab"."id" and "lab_teacher"."user_id" = ${ctx.user.id})`);
  const labs = await db.select().from(schema.labs).where(where).orderBy(asc(schema.labs.name));
  if (!labs.length) return [];
  const ids = labs.map((l) => l.id);
  const [faults, last, teachers] = await Promise.all([
    db.select({ labId: schema.labFaults.labId, station: schema.labFaults.station }).from(schema.labFaults)
      .where(and(inArray(schema.labFaults.labId, ids), isNull(schema.labFaults.fixedAt))),
    db.select({ labId: schema.labInspections.labId, day: sql<string>`max(${schema.labInspections.inspectedOn})::text` }).from(schema.labInspections)
      .where(inArray(schema.labInspections.labId, ids)).groupBy(schema.labInspections.labId),
    db.select({ labId: schema.labTeachers.labId, name: schema.users.name, email: schema.users.email }).from(schema.labTeachers)
      .innerJoin(schema.users, eq(schema.users.id, schema.labTeachers.userId)).where(inArray(schema.labTeachers.labId, ids)),
  ]);
  return labs.map((l) => {
    const open = faults.filter((f) => f.labId === l.id);
    const brokenPcs = new Set(open.filter((f) => f.station !== ROOM).map((f) => f.station)).size;
    return {
      ...l, openProblems: open.length, pcsWorking: Math.max(0, l.pcCount - brokenPcs),
      lastInspection: last.find((x) => x.labId === l.id)?.day ?? null,
      teachers: teachers.filter((t) => t.labId === l.id).map((t) => t.name ?? t.email ?? "Teacher"),
    };
  });
}

/** Problems of a lab, newest first: the open ones, or the recently fixed ones. */
export async function labProblems(labId: string, which: "open" | "fixed") {
  const reporter = sql<string | null>`(select coalesce("name", "email") from "user" where "user"."id" = "lab_fault"."reported_by_id")`;
  const fixer = sql<string | null>`(select coalesce("name", "email") from "user" where "user"."id" = "lab_fault"."fixed_by_id")`;
  return db.select({ f: schema.labFaults, reporter, fixer }).from(schema.labFaults)
    .where(and(eq(schema.labFaults.labId, labId), which === "open" ? isNull(schema.labFaults.fixedAt) : sql`${schema.labFaults.fixedAt} is not null`))
    .orderBy(which === "open" ? desc(schema.labFaults.reportedAt) : desc(schema.labFaults.fixedAt))
    .limit(which === "open" ? 500 : 30);
}

export async function labInspectionList(labId: string) {
  return db.select({ i: schema.labInspections, by: sql<string | null>`(select coalesce("name", "email") from "user" where "user"."id" = "lab_inspection"."by_id")` })
    .from(schema.labInspections).where(eq(schema.labInspections.labId, labId))
    .orderBy(desc(schema.labInspections.inspectedOn), desc(schema.labInspections.createdAt)).limit(24);
}

/** The school's teachers and admins, to choose who looks after a lab. */
export async function staffOf(orgId: string) {
  return db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.memberships.role })
    .from(schema.memberships).innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.orgId, orgId), inArray(schema.memberships.role, ["ADMIN", "INSTRUCTOR"])))
    .orderBy(asc(schema.users.name));
}
