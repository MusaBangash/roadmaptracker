import { requireTeachableCohort } from "@/lib/access";
import { cohortRows } from "@/lib/cohort-stats";

function csv(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cohort } = await requireTeachableCohort(id);
  const { tree, rows, expected } = await cohortRows(cohort);
  const head = ["Name", "Email", "Status", "Progress %", "Expected %", "Items done", "Items required", "Verified", "Stages passed", "Hours logged", "Attendance %", "Last active", "Risk",
    ...tree.map((s, i) => `S${i + 1} ${s.title} %`)];
  const lines = rows.map((r) => [
    r.user.name, r.user.email, r.enrollment.status, Math.round(r.sum.pct * 100), Math.round(expected * 100), r.sum.done, r.sum.required,
    r.sum.verified, r.sum.stagesPassed, r.hours, r.attendance ? Math.round((100 * r.attendance.present) / r.attendance.total) : "",
    r.last ? r.last.toISOString().slice(0, 10) : "", r.risk ?? "",
    ...r.sum.stages.map((s) => `${Math.round(s.pct * 100)}${s.signedOff === true ? " (passed)" : ""}`),
  ]);
  const body = "﻿" + [head, ...lines].map((l) => l.map(csv).join(",")).join("\r\n");
  const name = cohort.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-progress.csv"` },
  });
}
