"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireLabAccess, requireRole } from "@/lib/access";
import { audit } from "@/lib/audit";
import { pakistanDay } from "@/lib/certificate-design-core";
import {
  FAULT_STATUSES, ROOM, STATUS_LABELS, checkLab, cleanNote, inspectionSummary, readFindings, reconcile, stations, type FaultStatus,
} from "@/lib/lab-core";
import type { FormState } from "./auth";

const labForm = (form: FormData) => ({
  name: String(form.get("name") ?? ""), pcCount: String(form.get("pcCount") ?? ""),
  pcItems: String(form.get("pcItems") ?? ""), roomItems: String(form.get("roomItems") ?? ""),
});

/** Only the school's own teachers and admins can look after a lab. */
async function staffIds(orgId: string, wanted: string[]) {
  if (!wanted.length) return [];
  const rows = await db.select({ userId: schema.memberships.userId }).from(schema.memberships)
    .where(and(eq(schema.memberships.orgId, orgId), inArray(schema.memberships.userId, wanted), inArray(schema.memberships.role, ["ADMIN", "INSTRUCTOR"])));
  return rows.map((r) => r.userId);
}

/** Story 1: an admin adds a lab and chooses its teachers. */
export async function createLabAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  const lab = checkLab(labForm(form));
  if ("error" in lab) return { error: lab.error };
  const teachers = await staffIds(ctx.org.id, form.getAll("teacher").map(String));
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(schema.labs).values({ orgId: ctx.org.id, ...lab }).returning({ id: schema.labs.id });
    if (teachers.length) await tx.insert(schema.labTeachers).values(teachers.map((userId) => ({ labId: row.id, userId })));
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "lab.create", detail: `${lab.name}: ${lab.pcCount} PCs` }, tx);
    return row.id;
  });
  revalidatePath("/labs");
  redirect(`/labs/${id}`);
}

/** Story 1: an admin changes a lab (name, PCs, what is checked, teachers) or archives it. */
export async function updateLabAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireLabAccess(String(form.get("labId") ?? ""));
  if (ctx.role !== "ADMIN") return { error: "Only a school admin can change a lab." };
  const lab = checkLab(labForm(form));
  if ("error" in lab) return { error: lab.error };
  const teachers = await staffIds(ctx.org.id, form.getAll("teacher").map(String));
  const archived = form.get("archived") === "on";
  await db.transaction(async (tx) => {
    await tx.update(schema.labs).set({ ...lab, archived }).where(eq(schema.labs.id, ctx.lab.id));
    await tx.delete(schema.labTeachers).where(eq(schema.labTeachers.labId, ctx.lab.id));
    if (teachers.length) await tx.insert(schema.labTeachers).values(teachers.map((userId) => ({ labId: ctx.lab.id, userId })));
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "lab.update", detail: `${lab.name}${archived ? " (archived)" : ""}` }, tx);
  });
  revalidatePath("/labs", "layout");
  return { ok: "Saved. Old reports keep what the lab had then." };
}

/**
 * Story 2 + 5: save a monthly inspection. Problems found are opened (or updated if already open); open
 * problems the inspection found OK are marked fixed. The lab's PCs and items are copied into the report.
 */
export async function saveInspectionAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireLabAccess(String(form.get("labId") ?? ""));
  const lab = ctx.lab;
  const day = String(form.get("inspectedOn") ?? "");
  const today = pakistanDay(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return { error: "Choose the day of the inspection." };
  if (day > today) return { error: "The inspection day can't be in the future." };
  const findings = readFindings(lab, (k) => String(form.get(k) ?? ""));
  const note = cleanNote(String(form.get("note") ?? "")) || null;
  let inspectionId = "";
  try {
    inspectionId = await db.transaction(async (tx) => {
      // Lock the lab's open problems, so two inspections saved at once can't both open the same one.
      const open = await tx.select().from(schema.labFaults)
        .where(and(eq(schema.labFaults.labId, lab.id), isNull(schema.labFaults.fixedAt))).for("update");
      const [ins] = await tx.insert(schema.labInspections).values({
        labId: lab.id, orgId: ctx.org.id, inspectedOn: day, byId: ctx.user.id, labName: lab.name,
        pcCount: lab.pcCount, pcItems: lab.pcItems, roomItems: lab.roomItems, findings, note,
      }).returning({ id: schema.labInspections.id });
      const r = reconcile(lab, open, findings);
      if (r.create.length) {
        await tx.insert(schema.labFaults).values(r.create.map((f) => ({
          labId: lab.id, orgId: ctx.org.id, station: f.station, item: f.item, status: f.status, note: f.note || null,
          inspectionId: ins.id, reportedById: ctx.user.id, reportedAt: sql`now()`,
        })));
      }
      for (const u of r.update) await tx.update(schema.labFaults).set({ status: u.status, note: u.note || null }).where(eq(schema.labFaults.id, u.id));
      if (r.fixed.length) {
        await tx.update(schema.labFaults).set({ fixedAt: sql`now()`, fixedById: ctx.user.id, fixNote: `Found OK in the inspection of ${day}` })
          .where(inArray(schema.labFaults.id, r.fixed.map((f) => f.id)));
      }
      const s = inspectionSummary(lab, findings);
      await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "lab.inspect",
        detail: `${lab.name}, ${day}: ${s.pcsWorking}/${s.pcCount} PCs working, ${s.problems} problems, ${r.fixed.length} fixed` }, tx);
      return ins.id;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "Someone saved a problem for this lab at the same moment. Try Save again." };
    throw e;
  }
  revalidatePath("/labs", "layout");
  redirect(`/labs/${lab.id}/inspections/${inspectionId}`);
}

/** Story 4: report a problem on any day. If that thing already has an open problem, it is updated. */
export async function reportProblemAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireLabAccess(String(form.get("labId") ?? ""));
  const lab = ctx.lab;
  const station = String(form.get("station") ?? "");
  const item = String(form.get("item") ?? "");
  const status = String(form.get("status") ?? "") as FaultStatus;
  const items = station === ROOM ? lab.roomItems : stations(lab.pcCount).includes(station) ? lab.pcItems : [];
  if (!items.includes(item)) return { error: "Choose the PC (or the room) and what is wrong with it." };
  if (!FAULT_STATUSES.includes(status)) return { error: "Choose Missing, Not working or Damaged." };
  const note = cleanNote(String(form.get("note") ?? "")) || null;
  const where = and(eq(schema.labFaults.labId, lab.id), eq(schema.labFaults.station, station), eq(schema.labFaults.item, item), isNull(schema.labFaults.fixedAt));
  try {
    const [was] = await db.update(schema.labFaults).set({ status, note }).where(where).returning({ id: schema.labFaults.id });
    if (!was) {
      await db.insert(schema.labFaults).values({ labId: lab.id, orgId: ctx.org.id, station, item, status, note, reportedById: ctx.user.id, reportedAt: sql`now()` });
    }
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "Someone reported this at the same moment. It is in the list now." };
    throw e;
  }
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "lab.problem", detail: `${lab.name}: ${station} ${item} ${STATUS_LABELS[status].toLowerCase()}` });
  revalidatePath("/labs", "layout");
  return { ok: `Saved: ${station} · ${item} · ${STATUS_LABELS[status]}.` };
}

/** Story 5: the lab's teacher or an admin marks a problem fixed, with a note. The history stays. */
export async function fixProblemAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx0 = await requireRole(["ADMIN", "INSTRUCTOR"]);
  const fault = await db.query.labFaults.findFirst({ where: and(eq(schema.labFaults.id, String(form.get("faultId") ?? "")), eq(schema.labFaults.orgId, ctx0.org.id)) });
  if (!fault) return { error: "That problem isn't there any more." };
  const ctx = await requireLabAccess(fault.labId);
  const fixNote = cleanNote(String(form.get("fixNote") ?? "")) || null;
  const [done] = await db.update(schema.labFaults).set({ fixedAt: sql`now()`, fixedById: ctx.user.id, fixNote })
    .where(and(eq(schema.labFaults.id, fault.id), isNull(schema.labFaults.fixedAt))).returning({ id: schema.labFaults.id });
  if (!done) return { error: "Someone already marked it fixed." };
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "lab.fix", detail: `${ctx.lab.name}: ${fault.station} ${fault.item}${fixNote ? `: ${fixNote}` : ""}` });
  revalidatePath("/labs", "layout");
  return { ok: "Marked fixed." };
}
