"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireTeachableCohort } from "@/lib/access";
import { audit } from "@/lib/audit";
import { checkStudent, IMPORT_LIMIT, planImport, readStudentFile, type Existing, type RowProblem, type StudentRow } from "@/lib/import-core";
import { hashToken, newResetToken } from "@/lib/reset";
import { baseUrl } from "@/lib/url";
import { addableStudents } from "@/lib/add-students";
import { plural } from "@/lib/utils";
import { addedToClassMessage } from "@/lib/whatsapp";

// Adding many students to a cohort from a file (Step 5, feature 1), or from the students already in the
// school. Who may: the same people who may make the cohort's student invite links (its teachers, and the
// school's admins).

export type ImportPreview = {
  error?: string;
  create?: StudentRow[];
  add?: StudentRow[];
  skip?: StudentRow[];
  problems?: RowProblem[];
};

export type ImportResult = {
  error?: string;
  done?: { created: number; added: number; skipped: number; links: { name: string; email: string; link: string }[] };
};

/** Which of these emails already have an account, and whether they are already in the cohort. */
async function existingFor(cohortId: string, emails: string[]) {
  const map = new Map<string, Existing>();
  if (!emails.length) return map;
  const users = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(inArray(schema.users.email, emails));
  const enrolled = users.length
    ? new Set((await db.select({ userId: schema.enrollments.userId }).from(schema.enrollments)
      .where(and(eq(schema.enrollments.cohortId, cohortId), inArray(schema.enrollments.userId, users.map((u) => u.id)),
        notInArray(schema.enrollments.status, ["PENDING", "DECLINED"])))).map((e) => e.userId))
    : new Set<string>();
  for (const u of users) if (u.email) map.set(u.email, { userId: u.id, inCohort: enrolled.has(u.id) });
  return map;
}

/** Story 2: read and check the file and show what adding it would do. Nothing is saved. */
export async function previewImportAction(_: ImportPreview | undefined, form: FormData): Promise<ImportPreview> {
  const ctx = await requireTeachableCohort(String(form.get("cohortId") ?? ""));
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a file first." };
  if (file.size > IMPORT_LIMIT.fileBytes) return { error: "That file is too big. Save it as CSV and keep it under 1 MB." };
  const text = await file.text();
  if (text.startsWith("PK")) return { error: "That is an Excel file (.xlsx). In Excel choose File → Save As → CSV UTF-8, then upload the .csv file." };
  const read = readStudentFile(text);
  if (read.fileError) return { error: read.fileError };
  const plan = planImport(read.students, await existingFor(ctx.cohort.id, read.students.map((s) => s.email)));
  return { create: plan.create, add: plan.add.map((s) => ({ row: s.row, name: s.name, email: s.email })), skip: plan.skip, problems: read.problems };
}

const rowsSchema = z.array(z.object({ row: z.number().int(), name: z.string(), email: z.string() })).max(IMPORT_LIMIT.rows);

/** Story 3 + 4: add the checked students. Everything is checked again here (never trust the page):
 *  new people get an account and a one-time "set your password" link (14 days); people who already
 *  have an account are only added; nobody is added twice; names and passwords are never changed. */
export async function importStudentsAction(_: ImportResult | undefined, form: FormData): Promise<ImportResult> {
  const ctx = await requireTeachableCohort(String(form.get("cohortId") ?? ""));
  let raw: unknown;
  try { raw = JSON.parse(String(form.get("rows") ?? "[]")); } catch { return { error: "Upload the file again." }; }
  const parsed = rowsSchema.safeParse(raw);
  if (!parsed.success) return { error: "Upload the file again." };
  const students: StudentRow[] = [];
  const seen = new Set<string>();
  for (const r of parsed.data) {
    const c = checkStudent(r.name, r.email);
    if ("reason" in c || seen.has(c.email)) continue;
    seen.add(c.email);
    students.push({ row: r.row, ...c });
  }
  if (!students.length) return { error: "There is nobody to add." };

  const plan = planImport(students, await existingFor(ctx.cohort.id, students.map((s) => s.email)));
  const tokens: { name: string; email: string; token: string }[] = [];
  const { created, added } = await db.transaction(async (tx) => {
    let created = 0;
    const toEnroll = plan.add.map((s) => s.userId);
    if (plan.create.length) {
      // If someone registered with one of these emails a moment ago, they are added like an existing account.
      const made = await tx.insert(schema.users).values(plan.create.map((s) => ({ name: s.name, email: s.email })))
        .onConflictDoNothing({ target: schema.users.email }).returning({ id: schema.users.id, email: schema.users.email, name: schema.users.name });
      created = made.length;
      const madeEmails = new Set(made.map((m) => m.email));
      const late = plan.create.filter((s) => !madeEmails.has(s.email)).map((s) => s.email);
      if (late.length) toEnroll.push(...(await tx.select({ id: schema.users.id }).from(schema.users).where(inArray(schema.users.email, late))).map((u) => u.id));
      toEnroll.push(...made.map((m) => m.id));
      if (made.length) {
        const expiresAt = new Date(Date.now() + IMPORT_LIMIT.linkDays * 86400_000);
        const rows = made.map((m) => {
          const token = newResetToken();
          tokens.push({ name: m.name ?? "", email: m.email ?? "", token });
          return { userId: m.id, orgId: ctx.org.id, tokenHash: hashToken(token), expiresAt, createdById: ctx.user.id };
        });
        await tx.insert(schema.passwordResets).values(rows);
      }
    }
    if (toEnroll.length) {
      // Their place in the school: a new member is a student; an existing member keeps their role.
      await tx.insert(schema.memberships).values(toEnroll.map((userId) => ({ userId, orgId: ctx.org.id, role: "STUDENT" as const }))).onConflictDoNothing();
      // Chosen by the teacher: anyone waiting to join (or turned away) is accepted.
      await tx.insert(schema.enrollments).values(toEnroll.map((userId) => ({ cohortId: ctx.cohort.id, userId })))
        .onConflictDoUpdate({ target: [schema.enrollments.cohortId, schema.enrollments.userId], set: { status: "ACTIVE", leftOn: null, leftReason: null, leftNote: null },
          setWhere: inArray(schema.enrollments.status, ["PENDING", "DECLINED"]) });
    }
    const addedCount = toEnroll.length - created;
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "students.import",
      detail: `${ctx.cohort.name}: ${created} new, ${addedCount} existing added, ${plan.skip.length} already there` }, tx);
    return { created, added: addedCount };
  });
  revalidatePath(`/cohorts/${ctx.cohort.id}`, "layout");
  const url = await baseUrl();
  return { done: { created, added, skipped: plan.skip.length, links: tokens.map((t) => ({ name: t.name, email: t.email, link: `${url}/reset/${t.token}` })) } };
}

export type AddFromSchoolResult = { error?: string; ok?: string; message?: string };

/** "Add students from the school": put ticked students who already have an account in this class, Active
 *  straight away. Who may be added is worked out again here from the school's data (never the page). */
export async function addFromSchoolAction(_: AddFromSchoolResult | undefined, form: FormData): Promise<AddFromSchoolResult> {
  const ctx = await requireTeachableCohort(String(form.get("cohortId") ?? ""));
  const ids = [...new Set(form.getAll("userId").map(String))];
  if (!ids.length) return { error: "Tick the students to add first." };
  if (ids.length > IMPORT_LIMIT.rows) return { error: `Add at most ${IMPORT_LIMIT.rows} students at a time.` };
  const { students } = await addableStudents(ctx, ctx.cohort.id);
  const allowed = new Map(students.map((s) => [s.userId, s]));
  const chosen = ids.filter((id) => allowed.has(id));
  if (!chosen.length) return { error: "Those students are already in this class." };
  const back = chosen.filter((id) => allowed.get(id)!.here).length;

  const added = await db.transaction(async (tx) => {
    // A place that is Withdrawn, waiting or turned away becomes Active again (old work kept); a place that
    // became Active a moment ago is left alone and not counted.
    const rows = await tx.insert(schema.enrollments).values(chosen.map((userId) => ({ cohortId: ctx.cohort.id, userId })))
      .onConflictDoUpdate({ target: [schema.enrollments.cohortId, schema.enrollments.userId], set: { status: "ACTIVE", leftOn: null, leftReason: null, leftNote: null },
        setWhere: inArray(schema.enrollments.status, ["WITHDRAWN", "PENDING", "DECLINED"]) })
      .returning({ id: schema.enrollments.id });
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "students.add",
      detail: `${ctx.cohort.name}: ${rows.length} added${back ? ` (${back} had a place in it before)` : ""}` }, tx);
    return rows.length;
  });
  revalidatePath(`/cohorts/${ctx.cohort.id}`, "layout");
  const url = await baseUrl();
  return {
    ok: `Added ${plural(added, "student")} to ${ctx.cohort.name}. They see it the next time they open Tracks.`,
    message: addedToClassMessage({ cohort: ctx.cohort.name, school: ctx.org.name, link: `${url}/dashboard` }),
  };
}
