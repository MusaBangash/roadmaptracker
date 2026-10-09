import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

// The maths lives in coverage-core.ts (pure and tested); this file loads the data.
export * from "@/lib/coverage-core";

export type Taught = { taughtOn: string; by: string | null };

/** What a cohort has been taught: itemId → date and teacher's name. */
export async function loadCoverage(cohortId: string): Promise<Map<string, Taught>> {
  const rows = await db
    .select({ itemId: schema.cohortCoverage.itemId, taughtOn: schema.cohortCoverage.taughtOn, name: schema.users.name, email: schema.users.email })
    .from(schema.cohortCoverage)
    .leftJoin(schema.users, eq(schema.cohortCoverage.taughtById, schema.users.id))
    .where(eq(schema.cohortCoverage.cohortId, cohortId));
  return new Map(rows.map((r) => [r.itemId, { taughtOn: r.taughtOn, by: r.name ?? r.email ?? null }]));
}

/** Just the dates, as coverageOf() wants them. */
export const taughtDates = (m: Map<string, Taught>) => new Map([...m].map(([id, t]) => [id, t.taughtOn]));
