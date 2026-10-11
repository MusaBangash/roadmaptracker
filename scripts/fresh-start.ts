/**
 * Fresh start: empties the database for real use after testing.
 *
 *   npm run fresh-start
 *
 * Keeps:   the platform admin accounts (isSuperAdmin) and the official roadmaps.
 * Deletes: every school (with its people, cohorts, progress, certificates, labs, school roadmaps,
 *          invites and activity log), every other account, sign-in tries and reset links.
 * Then:    runs the normal sync, which makes the first school again (SEED_ORG_NAME) with the
 *          platform admin as its admin and every official roadmap turned on.
 *
 * Safety: it shows which database it is connected to (server and name, never the password) and what
 * is in it, and does nothing unless you type FRESH START. Make a copy first: on Neon a branch, on the
 * R730 deploy/backup.sh. Everything is one transaction, so it is all or nothing.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

const CONFIRM = "FRESH START";

async function count(table: string, where = "true") {
  const r = await db.execute(sql.raw(`select count(*)::int as n from "${table}" where ${where}`));
  return (r.rows[0] as { n: number }).n;
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const admins = await db.execute(sql`select email from "user" where is_super_admin order by email`);
  if (!admins.rows.length) {
    console.log("No platform admin in this database: a fresh start would leave nobody who can sign in. Stopped.");
    return 1;
  }
  const [schools, people, cohorts, students, certificates] = await Promise.all([
    count("organization"), count("user", "not is_super_admin"), count("cohort"), count("enrollment"), count("certificate"),
  ]);

  console.log(`\nDatabase: ${url.pathname.slice(1)} on ${url.hostname}\n`);
  console.log("It will DELETE:");
  console.log(`  ${schools} school(s), ${people} other account(s), ${cohorts} cohort(s), ${students} student enrollment(s), ${certificates} certificate(s)`);
  console.log("  and with them all progress, attendance, labs, school roadmaps, invites and the activity log.\n");
  console.log("It will KEEP:");
  console.log(`  platform admin(s): ${admins.rows.map((r) => (r as { email: string }).email).join(", ")}`);
  console.log("  the official roadmaps\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`Type ${CONFIRM} to continue (anything else cancels): `)).trim();
  rl.close();
  if (answer !== CONFIRM) {
    console.log("Cancelled. Nothing was changed.");
    return 0;
  }

  await db.transaction(async (tx) => {
    // A school takes everything of its own with it (memberships, cohorts and their students' work,
    // its roadmaps, certificates and designs, labs, invites, its activity log): all ON DELETE CASCADE.
    await tx.execute(sql`delete from "organization"`);
    await tx.execute(sql`delete from "user" where not is_super_admin`);
    // Rows that belong to no school.
    await tx.execute(sql`delete from "audit_log"`);
    await tx.execute(sql`delete from "login_attempt"`);
    await tx.execute(sql`delete from "password_reset"`);
    await tx.execute(sql`delete from "verificationToken"`);
  });
  console.log("\nDone: the database is empty except the platform admin(s) and the official roadmaps.");
  console.log("Making the first school again (npm run db:sync)...\n");
  try {
    execSync("npx tsx scripts/sync.ts", { stdio: "inherit" });
  } catch {
    console.error("\nThe wipe is done, but making the first school failed. Run: npm run db:sync");
    return 1;
  }
  return 0;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error("Fresh start stopped with an error (the wipe is all or nothing, so nothing was deleted):", e instanceof Error ? e.message : e);
  process.exit(1);
});
