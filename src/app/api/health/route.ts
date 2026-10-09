import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Story 8: is the app up, and can it reach the database? For uptime monitors (200 = fine, 503 = not).
 *  Says nothing about users or data. */
export async function GET() {
  const started = Date.now();
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("database timeout")), 5000)),
    ]);
    return Response.json({ status: "ok", database: "ok", ms: Date.now() - started, at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Health check failed:", (e as Error).message);
    return Response.json({ status: "down", database: "unreachable", ms: Date.now() - started, at: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
