/**
 * Idempotent sync, safe to run on every deploy:
 *  1. Loads content/tracks/*.json into track / stage / item (matched by key, never deletes progress —
 *     removed stages and items are marked archived).
 *  2. Ensures the platform admin (SEED_ADMIN_EMAIL) and first school (SEED_ORG_NAME) exist,
 *     and enables every track for that school.
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { and, eq, notInArray } from "drizzle-orm";
import { db, schema } from "../src/db";

type ItemJson = { key: string; title: string; detail?: string; kind?: string; group?: string; optional?: boolean };
type StageJson = {
  key: string; title: string; level?: string; weeks?: number; benchmark?: string; goal?: string; doneWhen?: string;
  resources?: string; optional?: boolean; choiceGroup?: string; items: ItemJson[];
};
type TrackJson = {
  slug: string; title: string; kind?: string; edition?: string; subtitle?: string; summary?: string; expert?: string;
  benchmarks?: { title: string; detail: string }[]; rubric?: { criterion: string; levels: string[] }[]; stages: StageJson[];
};

const KINDS = ["LESSON", "PROJECT", "DELIVERABLE", "MILESTONE"] as const;

async function syncTrack(t: TrackJson) {
  const values = {
    slug: t.slug, title: t.title, kind: t.kind ?? "ROLE", edition: t.edition ?? "", subtitle: t.subtitle ?? "",
    summary: t.summary ?? "", expert: t.expert ?? "", benchmarks: t.benchmarks ?? [], rubric: t.rubric ?? [], updatedAt: new Date(),
  };
  const [track] = await db.insert(schema.tracks).values(values)
    .onConflictDoUpdate({ target: schema.tracks.slug, set: values }).returning();

  const stageKeys: string[] = [];
  for (const [si, s] of t.stages.entries()) {
    stageKeys.push(s.key);
    const sv = {
      trackId: track.id, key: s.key, order: si, title: s.title, level: s.level ?? "", weeks: s.weeks ?? 0,
      benchmark: s.benchmark ?? "", goal: s.goal ?? "", doneWhen: s.doneWhen ?? "", resources: s.resources ?? "",
      optional: !!s.optional, choiceGroup: s.choiceGroup ?? null, archived: false,
    };
    const [stage] = await db.insert(schema.stages).values(sv)
      .onConflictDoUpdate({ target: [schema.stages.trackId, schema.stages.key], set: sv }).returning();

    const itemKeys: string[] = [];
    for (const [ii, it] of s.items.entries()) {
      itemKeys.push(it.key);
      const kind = (KINDS as readonly string[]).includes(it.kind ?? "") ? (it.kind as (typeof KINDS)[number]) : "LESSON";
      const iv = {
        stageId: stage.id, key: it.key, order: ii, title: it.title, detail: it.detail ?? "", kind,
        group: it.group ?? null, optional: !!it.optional, archived: false,
      };
      await db.insert(schema.items).values(iv)
        .onConflictDoUpdate({ target: [schema.items.stageId, schema.items.key], set: iv });
    }
    await db.update(schema.items).set({ archived: true })
      .where(and(eq(schema.items.stageId, stage.id), notInArray(schema.items.key, itemKeys)));
  }
  await db.update(schema.stages).set({ archived: true })
    .where(and(eq(schema.stages.trackId, track.id), notInArray(schema.stages.key, stageKeys)));
  return track;
}

async function ensureAdminAndOrg(trackIds: string[]) {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const orgName = process.env.SEED_ORG_NAME?.trim();
  if (!email || !orgName) {
    console.log("SEED_ADMIN_EMAIL / SEED_ORG_NAME not set — skipping admin and school setup.");
    return;
  }
  let user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user) {
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    [user] = await db.insert(schema.users)
      .values({ email, name: process.env.SEED_ADMIN_NAME ?? "Admin", passwordHash, isSuperAdmin: true }).returning();
    console.log(`Created platform admin ${email}`);
  } else if (!user.isSuperAdmin) {
    await db.update(schema.users).set({ isSuperAdmin: true }).where(eq(schema.users.id, user.id));
  }
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  let org = await db.query.organizations.findFirst({ where: eq(schema.organizations.slug, slug) });
  if (!org) {
    [org] = await db.insert(schema.organizations).values({ name: orgName, slug }).returning();
    console.log(`Created school "${orgName}"`);
  }
  await db.insert(schema.memberships).values({ userId: user.id, orgId: org.id, role: "ADMIN" }).onConflictDoNothing();
  for (const trackId of trackIds) {
    await db.insert(schema.orgTracks).values({ orgId: org.id, trackId }).onConflictDoNothing();
  }
}

async function main() {
  const dir = path.join(process.cwd(), "content", "tracks");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const ids: string[] = [];
  let nStages = 0, nItems = 0;
  for (const f of files) {
    const t = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as TrackJson;
    const track = await syncTrack(t);
    ids.push(track.id);
    nStages += t.stages.length;
    nItems += t.stages.reduce((n, s) => n + s.items.length, 0);
    console.log(`Synced ${t.slug} (${t.stages.length} stages)`);
  }
  console.log(`Synced ${files.length} tracks · ${nStages} stages · ${nItems} items`);
  await ensureAdminAndOrg(ids);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
