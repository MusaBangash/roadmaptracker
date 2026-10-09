import { requireTeachableCohort } from "@/lib/access";
import { and, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cohortRows } from "@/lib/cohort-stats";
import { isLesson } from "@/lib/coverage";
import { OTHER_GROUP } from "@/lib/progress";

function csv(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A UTF-8 CSV with a byte-order mark (so Excel reads Urdu names), lines ending in CRLF. */
function download(body: unknown[][], filename: string) {
  const csvBody = "\uFEFF" + body.map((l) => l.map(csv).join(",")).join("\r\n");
  return new Response(csvBody, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}

/** One row per item: where it sits in the plan, when it was taught and by whom, and how many
 *  active students have done it. */
async function teachingPlan(cohort: Parameters<typeof cohortRows>[0]) {
  const { tree, rows, coverage, taught } = await cohortRows(cohort);
  const active = rows.filter((r) => r.enrollment.status === "ACTIVE").map((r) => r.enrollment.id);
  const doneBy = new Map<string, number>();
  if (active.length) {
    const counts = await db.select({ itemId: schema.itemProgress.itemId, n: sql<number>`count(*)` }).from(schema.itemProgress)
      .where(and(inArray(schema.itemProgress.enrollmentId, active), ne(schema.itemProgress.status, "NEEDS_WORK")))
      .groupBy(schema.itemProgress.itemId);
    for (const c of counts) doneBy.set(c.itemId, Number(c.n));
  }
  const day = (weeks: number) => new Date(cohort.startDate.getTime() + weeks * 7 * 86400000).toISOString().slice(0, 10);
  const head = ["Stage", "Week", "Item", "Kind", "Required", "Planned from", "Planned to", "Status", "Taught on", "Taught by", "Students done", "Active students"];
  const lines = tree.flatMap((s, si) => {
    const cov = coverage.stages[si];
    return s.items.map((it) => {
      const gi = cov.groups.findIndex((g) => g.name === (it.group ?? OTHER_GROUP));
      const seg = gi >= 0 ? cov.groups[gi] : cov;
      const t = taught.get(it.id);
      const lesson = isLesson(it.kind);
      return [
        `${si + 1}. ${s.title}`, it.group ?? "", it.title, it.kind.toLowerCase(), it.optional ? "optional" : "required",
        day(seg.window.start), day(seg.window.end),
        lesson ? (t ? "taught" : seg.status ?? "") : "student work", t?.taughtOn ?? "", t?.by ?? "",
        String(doneBy.get(it.id) ?? 0), String(active.length),
      ];
    });
  });
  return [head, ...lines];
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cohort } = await requireTeachableCohort(id);
  const name = cohort.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  if (new URL(req.url).searchParams.get("type") === "plan") return download(await teachingPlan(cohort), `${name}-teaching-plan.csv`);
  const { tree, rows, expected } = await cohortRows(cohort);
  const head = ["Name", "Email", "Status", "Progress %", "Expected %", "Items done", "Items required", "Verified", "Stages passed", "Hours logged", "Attendance %", "Last active", "Risk",
    ...tree.map((s, i) => `S${i + 1} ${s.title} %`)];
  const lines = rows.map((r) => [
    r.user.name, r.user.email, r.enrollment.status, Math.round(r.sum.pct * 100), Math.round(expected * 100), r.sum.done, r.sum.required,
    r.sum.verified, r.sum.stagesPassed, r.hours, r.attendance ? Math.round((100 * r.attendance.present) / r.attendance.total) : "",
    r.last ? r.last.toISOString().slice(0, 10) : "", r.risk ?? "",
    ...r.sum.stages.map((s) => `${Math.round(s.pct * 100)}${s.signedOff === true ? " (passed)" : ""}`),
  ]);
  return download([head, ...lines], `${name}-progress.csv`);
}
