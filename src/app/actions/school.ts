"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole, requireTeachableEnrollment } from "@/lib/access";
import { audit } from "@/lib/audit";
import { GROUPS_MAX, groupNameProblem, RESIDENCE_WORDS, type Residence } from "@/lib/group-core";
import type { FormState } from "./auth";

// School settings: the school's own class groups (e.g. Morning Boys, Evening Girls) and its hostel.

function refresh() {
  revalidatePath("/admin/school");
  revalidatePath("/cohorts", "layout");
  revalidatePath("/dashboard");
}

/** Add a class group (admins). */
export async function addGroupAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  const name = String(form.get("name") ?? "").trim();
  const existing = await db.select({ name: schema.classGroups.name }).from(schema.classGroups).where(eq(schema.classGroups.orgId, ctx.org.id));
  if (existing.length >= GROUPS_MAX) return { error: `A school can have up to ${GROUPS_MAX} groups.` };
  const problem = groupNameProblem(name, existing.map((g) => g.name));
  if (problem) return { error: problem };
  const [made] = await db.insert(schema.classGroups).values({ orgId: ctx.org.id, name }).onConflictDoNothing().returning();
  if (!made) return { error: `There is already a group called "${name}".` };
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "school.groups", detail: `added ${name}` });
  refresh();
  return { ok: `Added ${name}.` };
}

/** Rename a class group (admins); classes keep their group. */
export async function renameGroupAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  const groupId = String(form.get("groupId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const group = await db.query.classGroups.findFirst({ where: and(eq(schema.classGroups.id, groupId), eq(schema.classGroups.orgId, ctx.org.id)) });
  if (!group) return { error: "That group no longer exists. Refresh the page." };
  if (name === group.name) return { ok: "Nothing changed." };
  const others = await db.select({ name: schema.classGroups.name }).from(schema.classGroups)
    .where(and(eq(schema.classGroups.orgId, ctx.org.id), ne(schema.classGroups.id, group.id)));
  const problem = groupNameProblem(name, others.map((g) => g.name));
  if (problem) return { error: problem };
  await db.update(schema.classGroups).set({ name }).where(eq(schema.classGroups.id, group.id));
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "school.groups", detail: `renamed ${group.name} → ${name}` });
  refresh();
  return { ok: "Saved." };
}

/** Remove a class group (admins): its classes stay, without a group. */
export async function deleteGroupAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const groupId = String(form.get("groupId") ?? "");
  const [gone] = await db.delete(schema.classGroups)
    .where(and(eq(schema.classGroups.id, groupId), eq(schema.classGroups.orgId, ctx.org.id))).returning();
  if (!gone) return;
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "school.groups", detail: `removed ${gone.name}` });
  refresh();
}

/** "We have a hostel" on or off (admins). Turning it off keeps each student's Hostel / Day scholar mark. */
export async function setHostelAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const on = form.get("on") === "1";
  await db.update(schema.organizations).set({ hasHostel: on }).where(eq(schema.organizations.id, ctx.org.id));
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "school.hostel", detail: on ? "on" : "off" });
  refresh();
  revalidatePath("/", "layout");
}

/** One student's Hostel / Day scholar mark, from their page (the cohort's teachers and admins). */
export async function setResidenceAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireTeachableEnrollment(String(form.get("enrollmentId") ?? ""));
  if (!ctx.org.hasHostel) return { error: "Turn on \"We have a hostel\" in School settings first." };
  const v = String(form.get("residence") ?? "");
  const residence = v === "HOSTEL" || v === "DAY" ? (v as Residence) : null;
  await db.update(schema.memberships).set({ residence })
    .where(and(eq(schema.memberships.orgId, ctx.org.id), eq(schema.memberships.userId, ctx.enrollment.userId)));
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "student.residence", subjectId: ctx.enrollment.userId,
    detail: residence ? RESIDENCE_WORDS[residence] : "not set" });
  revalidatePath(`/cohorts/${ctx.cohort.id}`, "layout");
  revalidatePath("/hostel");
  return { ok: "Saved." };
}
