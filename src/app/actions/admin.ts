"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireRole, requireTeachableCohort, requireUser } from "@/lib/access";
import { randomCode } from "@/lib/utils";
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
  if (!enabled) return { error: "That track isn't enabled for your school." };
  const [cohort] = await db.insert(schema.cohorts)
    .values({ orgId: ctx.org.id, trackId: p.data.trackId, name: p.data.name, startDate: new Date(p.data.startDate) }).returning();
  const instructorIds = form.getAll("instructorIds").map(String);
  for (const userId of instructorIds) {
    const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, ctx.org.id), eq(schema.memberships.userId, userId)) });
    if (m && m.role !== "STUDENT") await db.insert(schema.cohortInstructors).values({ cohortId: cohort.id, userId }).onConflictDoNothing();
  }
  redirect(`/cohorts/${cohort.id}`);
}

export async function setCohortInstructorAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const cohortId = String(form.get("cohortId"));
  const userId = String(form.get("userId"));
  const add = form.get("op") === "add";
  const cohort = await db.query.cohorts.findFirst({ where: and(eq(schema.cohorts.id, cohortId), eq(schema.cohorts.orgId, ctx.org.id)) });
  if (!cohort) return;
  if (add) await db.insert(schema.cohortInstructors).values({ cohortId, userId }).onConflictDoNothing();
  else await db.delete(schema.cohortInstructors).where(and(eq(schema.cohortInstructors.cohortId, cohortId), eq(schema.cohortInstructors.userId, userId)));
  revalidatePath(`/cohorts/${cohortId}`);
}

export async function archiveCohortAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const cohortId = String(form.get("cohortId"));
  await db.update(schema.cohorts).set({ archived: form.get("archived") === "1" })
    .where(and(eq(schema.cohorts.id, cohortId), eq(schema.cohorts.orgId, ctx.org.id)));
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
  revalidatePath(p.cohortId ? `/cohorts/${p.cohortId}` : "/admin/members");
}

export async function deleteInviteAction(form: FormData) {
  const id = String(form.get("inviteId"));
  const inv = await db.query.invites.findFirst({ where: eq(schema.invites.id, id) });
  if (!inv) return;
  if (inv.cohortId) await requireTeachableCohort(inv.cohortId);
  else await requireRole(["ADMIN"]);
  await db.delete(schema.invites).where(eq(schema.invites.id, id));
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
  revalidatePath("/admin/members");
}

export async function removeMemberAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const membershipId = String(form.get("membershipId"));
  const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.id, membershipId), eq(schema.memberships.orgId, ctx.org.id)) });
  if (!m || m.userId === ctx.user.id) return;
  await db.delete(schema.memberships).where(eq(schema.memberships.id, m.id));
  revalidatePath("/admin/members");
}

export async function toggleOrgTrackAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const trackId = String(form.get("trackId"));
  if (form.get("enabled") === "1") await db.insert(schema.orgTracks).values({ orgId: ctx.org.id, trackId }).onConflictDoNothing();
  else await db.delete(schema.orgTracks).where(and(eq(schema.orgTracks.orgId, ctx.org.id), eq(schema.orgTracks.trackId, trackId)));
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
  const allTracks = await db.select({ id: schema.tracks.id }).from(schema.tracks);
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
