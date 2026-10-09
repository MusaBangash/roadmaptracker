"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireEditableTrack, requireRole } from "@/lib/access";
import { canCopyTrack } from "@/lib/access-core";
import {
  edit, ITEM_KINDS, LIMITS, parseTrackDoc, publishProblems, RoadmapEditError, schoolSlug, type TrackDoc,
} from "@/lib/roadmap-core";
import { applyStages, liveDoc, trackValues } from "@/lib/track-store";
import type { FormState } from "./auth";

// Roadmap Builder (Step 3). A school's admins make and edit their school's own roadmaps; official
// roadmaps are only ever copied. Edits go to track.draft; Publish writes the draft into stage/item
// (matched by key, removed things archived, never deleted) so student work is always kept.

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).optional().transform((v) => v || undefined);
const titleField = z.string().trim().min(1, "Give it a title.").max(LIMITS.title, `Keep the title under ${LIMITS.title} characters.`);
const flag = z.preprocess((v) => v === "on" || v === "1", z.boolean());

const detailsSchema = z.object({
  title: titleField, kind: z.enum(["ROLE", "COURSE"]).default("COURSE"),
  edition: text(LIMITS.title), subtitle: text(LIMITS.title), summary: text(LIMITS.text),
});
const stageSchema = z.object({
  title: titleField, level: text(80), goal: text(LIMITS.text), doneWhen: text(LIMITS.text), optional: flag,
  weeks: z.preprocess((v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int("Weeks must be a whole number.").min(0, "Weeks can't be negative.").max(LIMITS.weeks, `At most ${LIMITS.weeks} weeks.`).optional()),
});
const itemSchema = z.object({
  title: titleField, detail: text(LIMITS.text), kind: z.enum(ITEM_KINDS).default("LESSON"), group: text(80), optional: flag,
});

const fields = (form: FormData, names: string[]) => Object.fromEntries(names.map((n) => [n, form.get(n) ?? undefined]));
function parse<T>(schema: z.ZodType<T>, form: FormData): T {
  const p = schema.safeParse(fields(form, ["title", "kind", "edition", "subtitle", "summary", "level", "goal", "doneWhen", "optional", "weeks", "detail", "group"]));
  if (!p.success) throw new RoadmapEditError(p.error.issues[0].message);
  return p.data;
}

const editPath = (slug: string) => `/tracks/${slug}/edit`;

/** Applies one change to the draft, inside a transaction that locks the roadmap so two admins
 *  editing at once never overwrite each other's change. */
async function changeDraft(trackId: string, change: (doc: TrackDoc) => TrackDoc): Promise<FormState> {
  const { track } = await requireEditableTrack(trackId);
  try {
    await db.transaction(async (tx) => {
      const [t] = await tx.select().from(schema.tracks).where(eq(schema.tracks.id, trackId)).for("update");
      const next = parseTrackDoc(change(t.draft ?? await liveDoc(tx, t)));
      if (!next.ok) throw new RoadmapEditError(next.errors[0]);
      await tx.update(schema.tracks).set({ draft: next.doc, updatedAt: new Date() }).where(eq(schema.tracks.id, trackId));
    });
  } catch (e) {
    if (e instanceof RoadmapEditError) return { error: e.message };
    throw e;
  }
  revalidatePath(editPath(track.slug));
  return { ok: "Saved to the draft." };
}

/** Every editing step of the builder: one action, the step named by the form's "op". */
export async function editRoadmapAction(_: FormState, form: FormData): Promise<FormState> {
  const trackId = String(form.get("trackId") ?? "");
  const stageKey = String(form.get("stageKey") ?? "");
  const itemKey = String(form.get("itemKey") ?? "");
  const dir = form.get("dir") === "up" ? -1 : 1;
  try {
    switch (form.get("op")) {
      case "details": { const d = parse(detailsSchema, form); return changeDraft(trackId, (doc) => edit.details(doc, d)); }
      case "addStage": { const s = parse(stageSchema, form); return changeDraft(trackId, (doc) => edit.addStage(doc, s)); }
      case "updateStage": { const s = parse(stageSchema, form); return changeDraft(trackId, (doc) => edit.updateStage(doc, stageKey, s)); }
      case "moveStage": return changeDraft(trackId, (doc) => edit.moveStage(doc, stageKey, dir));
      case "removeStage": return changeDraft(trackId, (doc) => edit.removeStage(doc, stageKey));
      case "addItem": { const it = parse(itemSchema, form); return changeDraft(trackId, (doc) => edit.addItem(doc, stageKey, it)); }
      case "updateItem": { const it = parse(itemSchema, form); return changeDraft(trackId, (doc) => edit.updateItem(doc, stageKey, itemKey, it)); }
      case "moveItem": return changeDraft(trackId, (doc) => edit.moveItem(doc, stageKey, itemKey, dir));
      case "removeItem": return changeDraft(trackId, (doc) => edit.removeItem(doc, stageKey, itemKey));
      default: return { error: "Unknown change." };
    }
  } catch (e) {
    if (e instanceof RoadmapEditError) return { error: e.message };
    throw e;
  }
}

async function newSchoolTrack(orgId: string, orgSlug: string, doc: TrackDoc) {
  const taken = new Set((await db.select({ slug: schema.tracks.slug }).from(schema.tracks)
    .where(sql`${schema.tracks.slug} like ${`${orgSlug.slice(0, 40)}--%`}`)).map((r) => r.slug));
  const slug = schoolSlug(orgSlug, doc.title, (s) => taken.has(s));
  const [track] = await db.insert(schema.tracks).values({
    slug, ...trackValues(doc), ownerOrgId: orgId, status: "DRAFT", draft: { ...doc, slug },
  }).returning();
  return track;
}

/** Story 1: a new, empty roadmap for the admin's school, as a draft. */
export async function createRoadmapAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  let d: z.infer<typeof detailsSchema>;
  try { d = parse(detailsSchema, form); } catch (e) { return { error: (e as Error).message }; }
  const track = await newSchoolTrack(ctx.org.id, ctx.org.slug, { ...d, stages: [] });
  redirect(editPath(track.slug));
}

/** Story 2: copy an official roadmap (or one of the school's own) into a new draft. */
export async function copyRoadmapAction(form: FormData) {
  const ctx = await requireRole(["ADMIN"]);
  const source = await db.query.tracks.findFirst({ where: eq(schema.tracks.id, String(form.get("trackId") ?? "")) });
  if (!source || !canCopyTrack({ userId: ctx.user.id, orgId: ctx.org.id, role: ctx.role }, source) || source.status !== "PUBLISHED") return;
  const doc = await liveDoc(db, source);
  const track = await newSchoolTrack(ctx.org.id, ctx.org.slug, { ...doc, title: `${source.title} (${ctx.org.name})`.slice(0, LIMITS.title) });
  redirect(editPath(track.slug));
}

export type ImportState = { errors?: string[] } | undefined;

/** Story 5: a roadmap file → a new draft, or the new draft of an existing roadmap (trackId). */
export async function importRoadmapAction(_: ImportState, form: FormData): Promise<ImportState> {
  const trackId = form.get("trackId") ? String(form.get("trackId")) : null;
  const target = trackId ? (await requireEditableTrack(trackId)).track : null;
  const ctx = await requireRole(["ADMIN"]);
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { errors: ["Choose a roadmap file (.json) first."] };
  if (file.size > LIMITS.fileBytes) return { errors: ["That file is too big. A roadmap file is at most 1 MB."] };
  let json: unknown;
  try { json = JSON.parse(await file.text()); } catch {
    return { errors: ["That isn't a roadmap file: it isn't valid JSON. Download a roadmap to see the format."] };
  }
  const p = parseTrackDoc(json);
  if (!p.ok) return { errors: p.errors };
  if (target) {
    const slug = target.slug;
    await db.update(schema.tracks).set({ draft: { ...p.doc, slug }, updatedAt: new Date() }).where(eq(schema.tracks.id, target.id));
    revalidatePath(editPath(slug));
    redirect(`${editPath(slug)}?uploaded=1`);
  }
  const track = await newSchoolTrack(ctx.org.id, ctx.org.slug, p.doc);
  redirect(`${editPath(track.slug)}?uploaded=1`);
}

/** Story 4: write the draft into the live roadmap. Removed items are archived, never deleted. */
export async function publishRoadmapAction(_: FormState, form: FormData): Promise<FormState> {
  const { track, org } = await requireEditableTrack(String(form.get("trackId") ?? ""));
  try {
    await db.transaction(async (tx) => {
      const [t] = await tx.select().from(schema.tracks).where(eq(schema.tracks.id, track.id)).for("update");
      if (!t.draft) throw new RoadmapEditError("There are no changes to publish.");
      const problems = publishProblems(t.draft);
      if (problems.length) throw new RoadmapEditError(problems.join(" "));
      await applyStages(tx, t.id, t.draft.stages);
      await tx.update(schema.tracks).set({ ...trackValues(t.draft), status: "PUBLISHED", draft: null, publishedAt: new Date() })
        .where(eq(schema.tracks.id, t.id));
      // The school can use its own roadmap for cohorts as soon as it is first published.
      if (t.status === "DRAFT") await tx.insert(schema.orgTracks).values({ orgId: org.id, trackId: t.id }).onConflictDoNothing();
    });
  } catch (e) {
    if (e instanceof RoadmapEditError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/tracks/${track.slug}`);
  revalidatePath("/tracks");
  // The Publish box disappears once there is nothing left to publish, so say it on the page.
  redirect(`${editPath(track.slug)}?published=1`);
}

/** Throw away unpublished changes (a published roadmap), or delete a roadmap never published. */
export async function discardRoadmapAction(form: FormData) {
  const { track } = await requireEditableTrack(String(form.get("trackId") ?? ""));
  if (track.status === "DRAFT") {
    // Never published, so no cohort can use it; deleting it loses nobody's work.
    await db.delete(schema.tracks).where(and(eq(schema.tracks.id, track.id), eq(schema.tracks.status, "DRAFT")));
    revalidatePath("/tracks");
    redirect("/tracks");
  }
  await db.update(schema.tracks).set({ draft: null }).where(eq(schema.tracks.id, track.id));
  revalidatePath(editPath(track.slug));
}
