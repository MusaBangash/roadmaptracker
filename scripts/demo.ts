/**
 * Demo data, so the progress screens can be seen working before real students join.
 *
 *   npm run demo:seed     creates (or re-creates) "Demo School" with two cohorts of fake students
 *   npm run demo:remove   deletes Demo School and every fake person, and nothing else
 *
 * Safety: it only touches the school whose slug is "demo-school" and users whose email ends in
 * "@demo.noorai.invalid" (a domain that can never be real). Fake users have no password, so
 * nobody can sign in as them. The SEED_ADMIN_EMAIL account is added to Demo School as admin
 * (switch schools from the avatar menu); removing the school removes that membership too.
 */
import "dotenv/config";
import { and, eq, inArray, like, notLike } from "drizzle-orm";
import { db, schema } from "../src/db";
import { OTHER_GROUP, REVIEW_KINDS, stageWindows } from "../src/lib/progress-core";
import { coverageOf, isLesson } from "../src/lib/coverage-core";

const SLUG = "demo-school";
const DOMAIN = "@demo.noorai.invalid";
const DAY = 24 * 3600 * 1000;
const WEEK = 7 * DAY;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Repeatable "random" numbers, so every seed gives the same demo.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261009);

/** How each fake student behaves, relative to where the plan expects them. */
type Profile = { name: string; offset: number; inactiveDays?: number; status?: "PAUSED" | "WITHDRAWN" };
/** teachLagWeeks: how far the demo teacher is behind the plan. */
const COHORTS: { name: string; track: string; weeksAgo: number; teachLagWeeks: number; students: Profile[] }[] = [
  {
    name: "Demo — Special Technician AI Engineer", track: "special-technician-ai-engineer", weeksAgo: 11, teachLagWeeks: 2,
    students: [
      { name: "Ayesha Khan", offset: 0.12 },
      { name: "Bilal Ahmed", offset: 0.03 },
      { name: "Fatima Noor", offset: 0 },
      { name: "Hamza Ali", offset: -0.08 },
      { name: "Zainab Riaz", offset: -0.22 },
      { name: "Usman Tariq", offset: -0.05, inactiveDays: 19 },
      { name: "Maryam Iqbal", offset: 0.06 },
      { name: "Saad Malik", offset: -0.3, status: "PAUSED" },
    ],
  },
  {
    name: "Demo — AI Engineer", track: "ai-engineer", weeksAgo: 14, teachLagWeeks: 0,
    students: [
      { name: "Ali Raza", offset: 0.08 },
      { name: "Hira Shah", offset: 0 },
      { name: "Iqra Hussain", offset: -0.18 },
      { name: "Ahmed Butt", offset: -0.04, inactiveDays: 23 },
      { name: "Sana Javed", offset: 0.02 },
    ],
  },
];

async function remove(tx: Tx) {
  const org = await tx.query.organizations.findFirst({ where: eq(schema.organizations.slug, SLUG) });
  if (org) {
    // Refuse if a real person (other than the seed admin) has joined the demo school.
    const real = await tx
      .select({ email: schema.users.email })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
      .where(and(eq(schema.memberships.orgId, org.id), notLike(schema.users.email, `%${DOMAIN}`)));
    const others = real.filter((r) => r.email !== process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim());
    if (others.length) throw new Error(`Demo School has real members (${others.map((o) => o.email).join(", ")}). Remove them first.`);
    // Cascades to its cohorts, enrollments, progress, sign-offs, logs, attendance, invites and memberships.
    await tx.delete(schema.organizations).where(eq(schema.organizations.id, org.id));
  }
  const fake = await tx.delete(schema.users).where(like(schema.users.email, `%${DOMAIN}`)).returning({ id: schema.users.id });
  return { school: !!org, people: fake.length };
}

async function seed(tx: Tx) {
  await remove(tx);
  const now = Date.now();
  const admin = process.env.SEED_ADMIN_EMAIL
    ? await tx.query.users.findFirst({ where: eq(schema.users.email, process.env.SEED_ADMIN_EMAIL.toLowerCase().trim()) })
    : undefined;

  const [org] = await tx.insert(schema.organizations).values({ name: "Demo School", slug: SLUG }).returning();
  const tracks = await tx.select().from(schema.tracks);
  await tx.insert(schema.orgTracks).values(tracks.map((t) => ({ orgId: org.id, trackId: t.id })));
  if (admin) await tx.insert(schema.memberships).values({ userId: admin.id, orgId: org.id, role: "ADMIN" });

  const [teacher] = await tx.insert(schema.users).values({ name: "Demo Instructor", email: `demo-instructor${DOMAIN}` }).returning();
  await tx.insert(schema.memberships).values({ userId: teacher.id, orgId: org.id, role: "INSTRUCTOR" });

  let n = 0, ticks = 0;
  for (const c of COHORTS) {
    const track = tracks.find((t) => t.slug === c.track);
    if (!track) throw new Error(`Track ${c.track} not found. Run npm run db:sync first.`);
    const stages = await tx.query.stages.findMany({ where: and(eq(schema.stages.trackId, track.id), eq(schema.stages.archived, false)), orderBy: schema.stages.order });
    const items = await tx.query.items.findMany({ where: and(inArray(schema.items.stageId, stages.map((s) => s.id)), eq(schema.items.archived, false)), orderBy: schema.items.order });
    const tree = stages.map((s) => ({ ...s, items: items.filter((i) => i.stageId === s.id) }));

    const start = new Date(now - c.weeksAgo * WEEK);
    const [cohort] = await tx.insert(schema.cohorts).values({ orgId: org.id, trackId: track.id, name: c.name, startDate: start }).returning();
    await tx.insert(schema.cohortInstructors).values({ cohortId: cohort.id, userId: teacher.id });

    // The plan, as a path through the track: alternatives in a choice group → only the first.
    const seen = new Set<string>();
    const path = tree.filter((s) => !s.choiceGroup || (!seen.has(s.choiceGroup) && seen.add(s.choiceGroup)));
    const { total } = stageWindows(tree);
    const expected = Math.min(1, c.weeksAgo / total);

    const roster: { id: string; active: boolean; done: Set<string> }[] = [];
    for (const p of c.students) {
      n++;
      const [u] = await tx.insert(schema.users).values({ name: p.name, email: `demo-student-${String(n).padStart(2, "0")}${DOMAIN}` }).returning();
      await tx.insert(schema.memberships).values({ userId: u.id, orgId: org.id, role: "STUDENT" });
      const joined = new Date(start.getTime() + rand() * 3 * DAY);
      const [enr] = await tx.insert(schema.enrollments).values({ cohortId: cohort.id, userId: u.id, status: p.status ?? "ACTIVE", createdAt: joined }).returning();

      const lastDay = now - (p.inactiveDays ?? rand() * 3) * DAY;
      const target = Math.max(0, Math.min(1, expected + p.offset));
      const required = path.flatMap((s) => s.items.filter((i) => !i.optional));
      const doneCount = Math.round(target * required.length);
      const doneIds = new Set(required.slice(0, doneCount).map((i) => i.id));
      // Students leave the odd gap near where they are working now, and do the odd optional item.
      for (const i of required.slice(Math.max(0, doneCount - 12), doneCount)) if (rand() < 0.15) doneIds.delete(i.id);
      for (const s of path) for (const i of s.items) if (i.optional && rand() < 0.15 && doneIds.size) doneIds.add(i.id);

      const ordered = path.flatMap((s) => s.items).filter((i) => doneIds.has(i.id));
      const rows = ordered.map((i, k) => {
        const at = new Date(joined.getTime() + ((k + 1) / (ordered.length + 1)) * (lastDay - joined.getTime()));
        const review = (REVIEW_KINDS as readonly string[]).includes(i.kind);
        const recent = k >= ordered.length - 3;
        const status = review ? (recent ? (rand() < 0.3 ? "NEEDS_WORK" : "DONE") : "VERIFIED") : rand() < 0.08 ? "VERIFIED" : "DONE";
        return {
          enrollmentId: enr.id, itemId: i.id, status: status as "DONE" | "VERIFIED" | "NEEDS_WORK",
          evidenceUrl: review ? `https://github.com/demo-student-${n}/${i.key}` : null,
          completedAt: at, updatedAt: at,
          reviewedById: status === "DONE" ? null : teacher.id, reviewedAt: status === "DONE" ? null : at,
          reviewNote: status === "NEEDS_WORK" ? "Add a README that explains how to run it, then send it again." : null,
        };
      });
      if (rows.length) await tx.insert(schema.itemProgress).values(rows);
      ticks += rows.length;

      // Sign off every stage the student finished; mark one "not yet" for a student who is behind.
      const finished = path.filter((s) => s.items.filter((i) => !i.optional).every((i) => doneIds.has(i.id)));
      const signoffs = finished.map((s) => ({ enrollmentId: enr.id, stageId: s.id, passed: true, notes: "Evidence seen and discussed.", signedById: teacher.id }));
      const firstOpen = path.find((s) => !finished.includes(s));
      if (p.offset <= -0.15 && firstOpen) signoffs.push({ enrollmentId: enr.id, stageId: firstOpen.id, passed: false, notes: "Not yet: finish the project first.", signedById: teacher.id });
      if (signoffs.length) await tx.insert(schema.stageSignoffs).values(signoffs);

      // Weekly logs and attendance for the weeks the student was active.
      const activeWeeks = Math.max(1, Math.floor((lastDay - joined.getTime()) / WEEK));
      await tx.insert(schema.weeklyLogs).values(Array.from({ length: Math.min(activeWeeks, 8) }, (_, w) => {
        const day = new Date(lastDay - w * WEEK);
        const monday = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - ((day.getUTCDay() + 6) % 7)));
        return {
          enrollmentId: enr.id, weekStart: monday.toISOString().slice(0, 10), hours: Math.round(4 + rand() * 10),
          finished: "Worked through the week's lessons and practice.", stuck: rand() < 0.3 ? "Needed help with the project setup." : "",
          updatedAt: day,
        };
      }));
      await tx.insert(schema.attendance).values(Array.from({ length: Math.min(c.weeksAgo, 10) }, (_, w) => ({
        enrollmentId: enr.id, date: new Date(start.getTime() + w * WEEK).toISOString().slice(0, 10),
        present: start.getTime() + w * WEEK < lastDay && rand() > 0.1,
      })));
      roster.push({ id: enr.id, active: (p.status ?? "ACTIVE") === "ACTIVE", done: doneIds });
    }

    // What the demo teacher has taught: each week of the plan, as far as the plan had reached
    // `teachLagWeeks` ago, taught on the days of that week's own plan window.
    const taughtWeeks = Math.max(0, c.weeksAgo - c.teachLagWeeks);
    const plan = coverageOf(tree, new Map(), start);
    const taughtRows = plan.stages.flatMap((st, si) => {
      if (tree[si].optional) return [];
      const req = tree[si].items.filter((i) => !i.optional);
      const segments = st.groups.length
        ? st.groups.map((g) => ({ w: g.window, lessons: req.filter((i) => (i.group ?? OTHER_GROUP) === g.name && isLesson(i.kind)) }))
        : [{ w: st.window, lessons: req.filter((i) => isLesson(i.kind)) }];
      return segments.flatMap(({ w, lessons }) => {
        const share = w.end > w.start ? Math.max(0, Math.min(1, (taughtWeeks - w.start) / (w.end - w.start))) : taughtWeeks >= w.start ? 1 : 0;
        const k = Math.round(share * lessons.length);
        return lessons.slice(0, k).map((l, j) => ({
          cohortId: cohort.id, itemId: l.id, taughtById: teacher.id,
          taughtOn: new Date(start.getTime() + (w.start + ((j + 0.5) / lessons.length) * (w.end - w.start)) * WEEK).toISOString().slice(0, 10),
        }));
      });
    });
    if (taughtRows.length) await tx.insert(schema.cohortCoverage).values(taughtRows);

    // The latest lesson was also ticked for the active students present that day ("Marked by teacher").
    const latest = taughtRows.at(-1);
    if (latest) {
      const present = roster.filter((r) => r.active && !r.done.has(latest.itemId));
      if (present.length) {
        await tx.insert(schema.attendance).values(present.map((r) => ({ enrollmentId: r.id, date: latest.taughtOn, present: true }))).onConflictDoNothing();
        await tx.insert(schema.itemProgress).values(present.map((r) => ({
          enrollmentId: r.id, itemId: latest.itemId, status: "DONE" as const, markedById: teacher.id,
          completedAt: new Date(`${latest.taughtOn}T12:00:00Z`), updatedAt: new Date(`${latest.taughtOn}T12:00:00Z`),
        })));
      }
    }
  }
  return { cohorts: COHORTS.length, students: n, ticks, admin: admin?.email ?? null };
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "seed") {
    const r = await db.transaction(seed);
    console.log(`Demo School ready: ${r.cohorts} cohorts, ${r.students} fake students, ${r.ticks} ticked items.`);
    console.log(r.admin ? `${r.admin} is its admin: switch school from your avatar menu.` : "Set SEED_ADMIN_EMAIL to be added as its admin.");
  } else if (cmd === "remove") {
    const r = await db.transaction(remove);
    console.log(r.school || r.people ? `Removed Demo School and ${r.people} fake people.` : "There was no demo data.");
  } else {
    console.log("Usage: npm run demo:seed | npm run demo:remove");
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
