import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";

export const ORG_COOKIE = "noor_org";

export const getUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return (await db.query.users.findFirst({ where: eq(schema.users.id, id) })) ?? null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** All schools the user belongs to, plus the active one (from cookie, else the first). */
export const getContext = cache(async () => {
  const user = await requireUser();
  const rows = await db
    .select({ m: schema.memberships, org: schema.organizations })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(eq(schema.memberships.userId, user.id))
    .orderBy(schema.organizations.name);
  const wanted = (await cookies()).get(ORG_COOKIE)?.value;
  const active = rows.find((r) => r.org.id === wanted) ?? rows[0] ?? null;
  return {
    user,
    memberships: rows.map((r) => ({ ...r.m, org: r.org })),
    org: active?.org ?? null,
    role: (active?.m.role ?? null) as Role | null,
  };
});

export async function requireRole(roles: Role[]) {
  const ctx = await getContext();
  if (!ctx.org || !ctx.role || !roles.includes(ctx.role)) redirect("/dashboard");
  return ctx as typeof ctx & { org: NonNullable<typeof ctx.org>; role: Role };
}

/** A cohort the current user may teach: school admins see all cohorts; instructors only their own. */
export async function requireTeachableCohort(cohortId: string) {
  const ctx = await requireRole(["ADMIN", "INSTRUCTOR"]);
  const cohort = await db.query.cohorts.findFirst({
    where: and(eq(schema.cohorts.id, cohortId), eq(schema.cohorts.orgId, ctx.org.id)),
  });
  if (!cohort) notFound();
  if (ctx.role === "INSTRUCTOR") {
    const link = await db.query.cohortInstructors.findFirst({
      where: and(eq(schema.cohortInstructors.cohortId, cohortId), eq(schema.cohortInstructors.userId, ctx.user.id)),
    });
    if (!link) notFound();
  }
  return { ...ctx, cohort };
}

/** An enrollment the current user owns (student view). */
export async function requireOwnEnrollment(enrollmentId: string) {
  const user = await requireUser();
  const enrollment = await db.query.enrollments.findFirst({
    where: and(eq(schema.enrollments.id, enrollmentId), eq(schema.enrollments.userId, user.id)),
  });
  if (!enrollment) notFound();
  return { user, enrollment };
}

/** An enrollment inside a cohort the current user teaches. */
export async function requireTeachableEnrollment(enrollmentId: string) {
  const enrollment = await db.query.enrollments.findFirst({ where: eq(schema.enrollments.id, enrollmentId) });
  if (!enrollment) notFound();
  const ctx = await requireTeachableCohort(enrollment.cohortId);
  return { ...ctx, enrollment };
}
