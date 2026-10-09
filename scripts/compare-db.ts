/**
 * Story 3 (moving from Neon): counts the rows of every table in two databases and shows them side
 * by side. Exits with an error if any table differs, so a copy is never trusted blindly.
 *   NEON_URL=… DATABASE_URL=… npx tsx scripts/compare-db.ts
 */
import { Client } from "pg";

async function counts(url: string) {
  const c = new Client({ connectionString: url });
  await c.connect();
  const tables = await c.query<{ s: string; t: string }>(
    `select table_schema s, table_name t from information_schema.tables
     where table_type = 'BASE TABLE' and table_schema in ('public', 'drizzle') order by 1, 2`);
  const out = new Map<string, number>();
  for (const { s, t } of tables.rows) {
    const r = await c.query<{ n: string }>(`select count(*) n from "${s}"."${t}"`);
    out.set(`${s}.${t}`, Number(r.rows[0].n));
  }
  await c.end();
  return out;
}

async function main() {
  const from = process.env.NEON_URL, to = process.env.DATABASE_URL;
  if (!from || !to) throw new Error("Set NEON_URL (the old database) and DATABASE_URL (this server's).");
  const [a, b] = await Promise.all([counts(from), counts(to)]);
  const names = [...new Set([...a.keys(), ...b.keys()])].sort();
  let bad = 0;
  console.log(`${"table".padEnd(32)} ${"Neon".padStart(8)} ${"here".padStart(8)}`);
  for (const n of names) {
    const x = a.get(n), y = b.get(n);
    const same = x === y;
    if (!same) bad++;
    console.log(`${n.padEnd(32)} ${String(x ?? "—").padStart(8)} ${String(y ?? "—").padStart(8)}${same ? "" : "   <-- DIFFERENT"}`);
  }
  console.log(bad ? `\n${bad} table(s) differ. Do not use this copy; run the move again.` : `\nAll ${names.length} tables match.`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
