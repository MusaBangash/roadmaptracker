import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireLabAccess } from "@/lib/access";
import { ROOM, STATUS_LABELS, cellsOf, cellKey } from "@/lib/lab-core";
import { csvFile } from "@/lib/csv";

/** Story 3: one inspection for Excel: every PC and item, with its result and note. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; inspectionId: string }> }) {
  const { id, inspectionId } = await params;
  const ctx = await requireLabAccess(id);
  const i = await db.query.labInspections.findFirst({ where: and(eq(schema.labInspections.id, inspectionId), eq(schema.labInspections.labId, ctx.lab.id)) });
  if (!i) return new Response("Not found", { status: 404 });
  const found = new Map(i.findings.map((f) => [cellKey(f.station, f.item), f]));
  const rows = cellsOf(i).map(({ station, item }) => {
    const f = found.get(cellKey(station, item));
    return [station === ROOM ? "Room" : station, item, f ? STATUS_LABELS[f.status] : "OK", f?.note ?? ""];
  });
  const name = `${i.labName}-${i.inspectedOn}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new Response(csvFile([[`${ctx.org.name} · ${i.labName} · inspection ${i.inspectedOn}`], ["Where", "Item", "Result", "Note"], ...rows]), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "no-store" },
  });
}
