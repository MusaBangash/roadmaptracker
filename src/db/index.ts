import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// One pool per server instance; reused across hot reloads in development.
const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    // Neon and home networks silently drop idle connections; reusing a dropped one fails the
    // page with "Connection terminated unexpectedly". Close idle ones first and keep the rest alive.
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    // Fail a stuck connect in 10 s with a clear error instead of hanging the page.
    connectionTimeoutMillis: 10_000,
  });
  // An idle connection dropped by the network must not crash the server; the pool replaces it.
  pool.on("error", (err) => console.warn("Database connection dropped while idle:", err.message));
  return pool;
}

const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
