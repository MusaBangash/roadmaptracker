"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireRole, requireTeachableCohort, requireUser } from "@/lib/access";
import { canUseTrack } from "@/lib/access-core";
import { canResetPassword, deleteScope, type Person } from "@/lib/security-core";
import { canChangeTrack, cohortChanges } from "@/lib/cohort-core";
import { audit } from "@/lib/audit";
import { hashToken, newResetToken, RESET_HOURS } from "@/lib/reset";
import { baseUrl } from "@/lib/url";
import { randomCode, schoolToday } from "@/lib/utils";
import type { FormState } from "./auth";

const cohortSchema = z.object({
  name: z.string().trim().min(2, "Give the cohort a name, e.g. “AI Engineer — Oct 2026”.").max(80),
  trackId: z.string().min(1, "Choose a track."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
});

export async function createCohortAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  const p = cohortSchema.safeParse({ name: form.get("name"), trackId: form.get("trackId"), startDate: form.get("startDate") });
  if (!p.success) return { error: p.error.issues[0].message };
  const enabled = await db.query.orgTracks.findFirst({
    where: and(eq(schema.orgTracks.orgId, ctx.org.id), eq(schema.orgTracks.trackId, p.data.trackId)),
  });
  const track = await db.query.tracks.findFirst({ where: eq(schema.tracks.id, p.data.trackId) });
  if (!enabled || !track || !canUseTrack(ctx.org.id, track)) return { error: "That track isn't enabled for your school." };
  const [cohort] = await db.insert(schema.cohorts)
    .values({ orgId: ctx.org.id, trackId: p.data.trackId, name: p.data.name, startDate: new Date(p.data.startDate) }).returning();
  const instructorIds = form.getAll("instructorIds").map(String);
  for (const userId of instructorIds) {
    const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, ctx.org.id), eq(schema.memberships.userId, userId)) });
    if (m && m.role !== "STUDENT") await db.insert(schema.cohortInstructors).values({ cohortId: cohort.id, userId }).onConflictDoNothing();
  }
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "cohort.create", detail: cohort.name });
  redirect(`/cohorts/${cohort.id}`);
}

/** Fix a cohort's name, start date or (while nobody is enrolled) roadmap. Admins and its teachers. */
export async function updateCohortAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireTeachableCohort(String(form.get("cohortId") ?? ""));
  const p = cohortSchema.safeParse({ name: form.get("name"), trackId: form.get("trackId") || ctx.cohort.trackId, startDate: form.get("startDate") });
  if (!p.success) return { error: p.error.issues[0].message };
  const after = p.data;
  const result = await db.transaction(async (tx) => {
    // Locked, so a student joining at the same moment can't slip in while the roadmap changes.
    const [cohort] = await tx.select().from(schema.cohorts).where(eq(schema.cohorts.id, ctx.cohort.id)).for("update");
    const before = { name: cohort.name, startDate: cohort.startDate.toISOString().slice(0, 10), trackId: cohort.trackId };
    if (after.trackId !== before.trackId) {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.enrollments).where(eq(schema.enrollments.cohortId, cohort.id));
      if (!canChangeTrack(n)) return { error: "The roadmap can't change any more: students have joined, and their ticks belong to this roadmap's lessons." };
      const enabled = await tx.query.orgTracks.findFirst({ where: and(eq(schema.orgTracks.orgId, ctx.org.id), eq(schema.orgTracks.trackId, after.trackId)) });
      const track = await tx.query.tracks.findFirst({ where: eq(schema.tracks.id, after.trackId) });
      if (!enabled || !track || !canUseTrack(ctx.org.id, track)) return { error: "That track isn't enabled for your school." };
      // Lessons marked taught belong to the old roadmap.
      await tx.delete(schema.cohortCoverage).where(eq(schema.cohortCoverage.cohortId, cohort.id));
    }
    const titles = await tx.select({ id: schema.tracks.id, title: schema.tracks.title }).from(schema.tracks)
      .where(inArray(schema.tracks.id, [before.trackId, after.trackId]));
    const detail = cohortChanges(before, after, (id) => titles.find((t) => t.id === id)?.title ?? "Unknown roadmap");
    if (!detail) return { ok: "Nothing changed." };
    await tx.update(schema.cohorts).set({ name: after.name, startDate: new Date(after.startDate), trackId: after.trackId }).where(eq(schema.cohorts.id, cohort.id));
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "cohort.update", detail }, tx);
    return null;
  });
  if (result) return result;
  revalidatePath("/cohorts");
  redirect(`/cohorts/${ctx.cohort.id}`);
}

const schoolNameSchema = z.string().trim().min(2, "Type the school's name (2 to 120 characters).").max(120, "Type the school's name (2 to 120 characters).");

/**
 * Rename a school: its admins rename the active school; the platform admin any school (orgId in the
 * form). The slug stays, and certificates already issued keep the name printed on them.
 */
export async function renameSchoolAction(_: FormState, form: FormData): Promise<FormState> {
  const asked = String(form.get("orgId") ?? "");
  const user = await requireUser();
  let orgId: string;
  if (asked && user.isSuperAdmin) orgId = asked;
  else orgId = (await requireRole(["ADMIN"])).org.id;
  const p = schoolNameSchema.safeParse(form.get("name"));
  if (!p.success) return { error: p.error.issues[0].message };
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) return { error: "That school doesn't exist." };
  if (org.name === p.data) return { ok: "Nothing changed." };
  await db.update(schema.organizations).set({ name: p.data }).where(eq(schema.organizations.id, orgId));
  await audit({ orgId, actorId: user.id, action: "school.rename", detail: `${org.name} → ${p.data}` });
  revalidatePath("/", "layout");
  return { ok: `Saved. The school is now called ${p.data}.` };
}

export async function setCohortInstructorAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const cohortId = String(form.get("cohortId"));
  const userId = String(form.get("userId"));
  const add = form.get("op") === "add";
  const cohort = await db.query.cohorts.findFirst({ where: and(eq(schema.cohorts.id, cohortId), eq(schema.cohorts.orgId, ctx.org.id)) });
  if (!cohort) return;
  if (add) {
    // Only staff of this school can teach its cohorts.
    const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, ctx.org.id), eq(schema.memberships.userId, userId)) });
    if (!m || m.role === "STUDENT") return;
    await db.insert(schema.cohortInstructors).values({ cohortId, userId }).onConflictDoNothing();
  } else await db.delete(schema.cohortInstructors).where(and(eq(schema.cohortInstructors.cohortId, cohortId), eq(schema.cohortInstructors.userId, userId)));
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "cohort.instructor", subjectId: userId, detail: `${add ? "Added to" : "Removed from"} ${cohort.name}` });
  revalidatePath(`/cohorts/${cohortId}`);
}

export async function archiveCohortAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const cohortId = String(form.get("cohortId"));
  const [c] = await db.update(schema.cohorts).set({ archived: form.get("archived") === "1" })
    .where(and(eq(schema.cohorts.id, cohortId), eq(schema.cohorts.orgId, ctx.org.id))).returning();
  if (c) await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "cohort.archive", detail: `${c.name}: ${c.archived ? "archived" : "reopened"}` });
  revalidatePath("/cohorts");
  revalidatePath(`/cohorts/${cohortId}`);
}

const inviteSchema = z.object({
  role: z.enum(["ADMIN", "INSTRUCTOR", "STUDENT"]),
  cohortId: z.string().optional(),
  maxUses: z.coerce.number().int().min(1).max(500).default(50),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export async function createInviteAction(form: FormData) {
  const raw = Object.fromEntries(form);
  const p = inviteSchema.parse({ ...raw, cohortId: raw.cohortId || undefined });
  let orgId: string;
  let userId: string;
  if (p.cohortId) {
    const ctx = await requireTeachableCohort(p.cohortId);
    if (ctx.role !== "ADMIN" && p.role !== "STUDENT") throw new Error("Instructors can only invite students");
    orgId = ctx.org.id; userId = ctx.user.id;
  } else {
    const ctx = await requireRole(["ADMIN"]);
    orgId = ctx.org.id; userId = ctx.user.id;
  }
  await db.insert(schema.invites).values({
    code: randomCode(10), orgId, role: p.role, cohortId: p.cohortId ?? null, maxUses: p.maxUses,
    expiresAt: new Date(Date.now() + p.days * 86400000), createdById: userId,
  });
  await audit({ orgId, actorId: userId, action: "invite.create", detail: `${p.role.toLowerCase()}, ${p.maxUses} uses, ${p.days} days` });
  revalidatePath(p.cohortId ? `/cohorts/${p.cohortId}` : "/admin/members");
}

export async function deleteInviteAction(form: FormData) {
  const id = String(form.get("inviteId"));
  const base = await requireRole(["ADMIN", "INSTRUCTOR"]);
  // Only an invite of the active school is ever found, never another school's.
  const inv = await db.query.invites.findFirst({ where: and(eq(schema.invites.id, id), eq(schema.invites.orgId, base.org.id)) });
  if (!inv) return;
  // School-wide invites: admins only. Cohort invites: anyone who teaches that cohort.
  const ctx = inv.cohortId ? await requireTeachableCohort(inv.cohortId) : await requireRole(["ADMIN"]);
  await db.delete(schema.invites).where(eq(schema.invites.id, id));
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "invite.delete", detail: inv.role.toLowerCase() });
  revalidatePath(inv.cohortId ? `/cohorts/${inv.cohortId}` : "/admin/members");
}

export async function setMemberRoleAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const membershipId = String(form.get("membershipId"));
  const role = z.enum(["ADMIN", "INSTRUCTOR", "STUDENT"]).parse(form.get("role"));
  const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.id, membershipId), eq(schema.memberships.orgId, ctx.org.id)) });
  if (!m) return;
  if (m.userId === ctx.user.id && role !== "ADMIN") {
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.memberships)
      .where(and(eq(schema.memberships.orgId, ctx.org.id), eq(schema.memberships.role, "ADMIN"), ne(schema.memberships.id, m.id)));
    if (Number(n) === 0) return; // never leave a school without an admin
  }
  await db.update(schema.memberships).set({ role }).where(eq(schema.memberships.id, m.id));
  if (role !== m.role) await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "member.role", subjectId: m.userId, detail: `${m.role.toLowerCase()} → ${role.toLowerCase()}` });
  revalidatePath("/admin/members");
}

/**
 * Remove someone from the school. Their places in this school's cohorts become Withdrawn (history kept),
 * and they stop teaching its cohorts and looking after its labs. Other schools are not touched.
 */
export async function removeMemberAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const membershipId = String(form.get("membershipId"));
  const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.id, membershipId), eq(schema.memberships.orgId, ctx.org.id)) });
  if (!m || m.userId === ctx.user.id) return;
  const orgCohorts = sql`(select "id" from "cohort" where "cohort"."org_id" = ${ctx.org.id})`;
  const orgLabs = sql`(select "id" from "lab" where "lab"."org_id" = ${ctx.org.id})`;
  await db.transaction(async (tx) => {
    const withdrawn = await tx.update(schema.enrollments).set({ status: "WITHDRAWN", leftOn: schoolToday(), leftReason: "REMOVED", leftNote: null })
      .where(and(eq(schema.enrollments.userId, m.userId), inArray(schema.enrollments.status, ["ACTIVE", "PAUSED", "COMPLETED"]), sql`${schema.enrollments.cohortId} in ${orgCohorts}`))
      .returning({ id: schema.enrollments.id });
    // Still on a waiting list: turned away (never part of the class, so not "withdrawn").
    await tx.update(schema.enrollments).set({ status: "DECLINED" })
      .where(and(eq(schema.enrollments.userId, m.userId), eq(schema.enrollments.status, "PENDING"), sql`${schema.enrollments.cohortId} in ${orgCohorts}`));
    const teaching = await tx.delete(schema.cohortInstructors)
      .where(and(eq(schema.cohortInstructors.userId, m.userId), sql`${schema.cohortInstructors.cohortId} in ${orgCohorts}`))
      .returning({ id: schema.cohortInstructors.cohortId });
    const labs = await tx.delete(schema.labTeachers)
      .where(and(eq(schema.labTeachers.userId, m.userId), sql`${schema.labTeachers.labId} in ${orgLabs}`))
      .returning({ id: schema.labTeachers.labId });
    await tx.delete(schema.memberships).where(eq(schema.memberships.id, m.id));
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "member.remove", subjectId: m.userId,
      detail: `${m.role.toLowerCase()}; withdrawn from ${withdrawn.length} cohort(s); taken off ${teaching.length} cohort(s) and ${labs.length} lab(s)` }, tx);
  });
  revalidatePath("/admin/members");
  revalidatePath("/cohorts", "layout");
}

export async function toggleOrgTrackAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const trackId = String(form.get("trackId"));
  const track = await db.query.tracks.findFirst({ where: eq(schema.tracks.id, trackId) });
  // Only official roadmaps and the school's own published ones; never another school's.
  if (!track || !canUseTrack(ctx.org.id, track)) return;
  const on = form.get("enabled") === "1";
  if (on) await db.insert(schema.orgTracks).values({ orgId: ctx.org.id, trackId }).onConflictDoNothing();
  else await db.delete(schema.orgTracks).where(and(eq(schema.orgTracks.orgId, ctx.org.id), eq(schema.orgTracks.trackId, trackId)));
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "track.toggle", detail: `${track.title}: ${on ? "on" : "off"}` });
  revalidatePath("/tracks");
}

// ---------- platform (super admin) ----------
const orgSchema = z.object({
  name: z.string().trim().min(2, "Enter the school's name.").max(100),
  adminEmail: z.string().trim().toLowerCase().email("Enter the admin's email.").optional().or(z.literal("")),
});

export async function createOrgAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.isSuperAdmin) return { error: "Only platform admins can create schools." };
  const p = orgSchema.safeParse({ name: form.get("name"), adminEmail: form.get("adminEmail") });
  if (!p.success) return { error: p.error.issues[0].message };
  const base = p.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "school";
  let slug = base;
  for (let i = 2; await db.query.organizations.findFirst({ where: eq(schema.organizations.slug, slug) }); i++) slug = `${base}-${i}`;
  const [org] = await db.insert(schema.organizations).values({ name: p.data.name, slug }).returning();
  // A new school starts with every official roadmap; other schools' own roadmaps stay theirs.
  const allTracks = await db.select({ id: schema.tracks.id }).from(schema.tracks).where(isNull(schema.tracks.ownerOrgId));
  if (allTracks.length) await db.insert(schema.orgTracks).values(allTracks.map((t) => ({ orgId: org.id, trackId: t.id }))).onConflictDoNothing();
  await db.insert(schema.memberships).values({ userId: user.id, orgId: org.id, role: "ADMIN" }).onConflictDoNothing();
  let msg = `Created ${org.name}.`;
  if (p.data.adminEmail) {
    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, p.data.adminEmail) });
    if (existing) {
      await db.insert(schema.memberships).values({ userId: existing.id, orgId: org.id, role: "ADMIN" }).onConflictDoNothing();
      msg += ` ${p.data.adminEmail} is now its admin.`;
    } else {
      const code = randomCode(10);
      await db.insert(schema.invites).values({ code, orgId: org.id, role: "ADMIN", maxUses: 1, expiresAt: new Date(Date.now() + 30 * 86400000), createdById: user.id });
      msg += ` Send the admin this invite link: /join/${code}`;
    }
  }
  revalidatePath("/platform");
  return { ok: msg };
}

// ---------- Story 2: password reset links, Story 7: deleting a person ----------

async function personOf(userId: string): Promise<(Person & { email: string | null }) | null> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) return null;
  const memberships = await db.select({ orgId: schema.memberships.orgId, role: schema.memberships.role })
    .from(schema.memberships).where(eq(schema.memberships.userId, userId));
  return { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin, memberships };
}

/** A one-time link (1 hour) that lets this person choose a new password. Shown once, never stored. */
export async function createResetLinkAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  const target = await personOf(String(form.get("userId") ?? ""));
  const adminOf = ctx.memberships.filter((m) => m.role === "ADMIN").map((m) => m.orgId);
  if (!target || !target.memberships.some((m) => m.orgId === ctx.org.id)
    || !canResetPassword({ id: ctx.user.id, adminOf, isSuperAdmin: ctx.user.isSuperAdmin }, target)) {
    return { error: target && target.memberships.some((m) => !adminOf.includes(m.orgId))
      ? "This person is also in another school, so only NoorAI support can reset their password."
      : "You can't make a reset link for this person." };
  }
  const token = newResetToken();
  await db.transaction(async (tx) => {
    // Any older unused link for this person stops working.
    await tx.delete(schema.passwordResets).where(and(eq(schema.passwordResets.userId, target.id), isNull(schema.passwordResets.usedAt)));
    await tx.insert(schema.passwordResets).values({
      userId: target.id, orgId: ctx.org.id, tokenHash: hashToken(token), createdById: ctx.user.id,
      expiresAt: new Date(Date.now() + RESET_HOURS * 3600_000),
    });
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "password.reset_link", subjectId: target.id }, tx);
  });
  return { ok: `${await baseUrl()}/reset/${token}` };
}

/** Permanently deletes a person's data: the whole account if they are only in this school,
 *  otherwise only their place and work in this school. The admin must type the person's email. */
export async function deletePersonAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  const target = await personOf(String(form.get("userId") ?? ""));
  if (!target) return { error: "That person no longer exists." };
  const typed = String(form.get("confirmEmail") ?? "").trim().toLowerCase();
  if (!target.email || typed !== target.email.toLowerCase()) return { error: "Type the person's email exactly to confirm." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.memberships)
    .where(and(eq(schema.memberships.orgId, ctx.org.id), eq(schema.memberships.role, "ADMIN")));
  const adminOf = ctx.memberships.filter((m) => m.role === "ADMIN").map((m) => m.orgId);
  const scope = deleteScope({ id: ctx.user.id, adminOf }, target, ctx.org.id, Number(n));
  if (!scope) return { error: "You can't delete this person. Not yourself, not a platform admin, and never the school's last admin." };
  const role = target.memberships.find((m) => m.orgId === ctx.org.id)!.role;
  await db.transaction(async (tx) => {
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "person.delete", subjectId: target.id,
      detail: scope === "account" ? `${role.toLowerCase()}, whole account` : `${role.toLowerCase()}, this school only` }, tx);
    if (scope === "account") {
      // Everything they own goes with them (enrollments → ticks, evidence, logs, attendance, sign-offs, assessments).
      await tx.delete(schema.users).where(eq(schema.users.id, target.id));
      return;
    }
    const cohortIds = tx.select({ id: schema.cohorts.id }).from(schema.cohorts).where(eq(schema.cohorts.orgId, ctx.org.id));
    await tx.delete(schema.enrollments).where(and(eq(schema.enrollments.userId, target.id), inArray(schema.enrollments.cohortId, cohortIds)));
    await tx.delete(schema.cohortInstructors).where(and(eq(schema.cohortInstructors.userId, target.id), inArray(schema.cohortInstructors.cohortId, cohortIds)));
    await tx.delete(schema.memberships).where(and(eq(schema.memberships.userId, target.id), eq(schema.memberships.orgId, ctx.org.id)));
  });
  revalidatePath("/admin/members");
  // The person's row disappears, so the confirmation is shown at the top of the page.
  redirect(`/admin/members?deleted=${scope}`);
}
