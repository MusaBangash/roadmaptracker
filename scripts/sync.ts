/**
 * Idempotent sync, safe to run on every deploy:
 *  1. Checks and loads content/tracks/*.json (the official roadmaps) into track / stage / item via
 *     src/lib/track-store.ts (matched by key, never deletes progress — removed stages and items are
 *     archived). Schools' own roadmaps (Roadmap Builder) are never touched.
 *  2. Ensures the platform admin (SEED_ADMIN_EMAIL) and first school (SEED_ORG_NAME) exist,
 *     and enables every track for that school.
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { isOfficialSlug, parseTrackDoc, type TrackDoc } from "../src/lib/roadmap-core";
import { applyStages, trackValues } from "../src/lib/track-store";

async function syncTrack(t: TrackDoc & { slug: string }) {
  if (!isOfficialSlug(t.slug)) throw new Error(`${t.slug}: official slugs can't contain "--" (that marks a school's own roadmap)`);
  const existing = await db.query.tracks.findFirst({ where: eq(schema.tracks.slug, t.slug) });
  if (existing?.ownerOrgId) throw new Error(`${t.slug}: a school's own roadmap already uses this slug`);
  const values = { slug: t.slug, ...trackValues(t) };
  return db.transaction(async (tx) => {
    const [track] = await tx.insert(schema.tracks).values(values)
      .onConflictDoUpdate({ target: schema.tracks.slug, set: values }).returning();
    await applyStages(tx, track.id, t.stages);
    return track;
  });
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
    const parsed = parseTrackDoc(JSON.parse(readFileSync(path.join(dir, f), "utf8")));
    if (!parsed.ok) throw new Error(`${f}: ${parsed.errors.join("; ")}`);
    const t = parsed.doc;
    if (!t.slug) throw new Error(`${f}: missing "slug"`);
    const track = await syncTrack({ ...t, slug: t.slug });
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
