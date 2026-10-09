import { requireRole } from "@/lib/access";
import { CHARTS, insightTables, loadInsights, parseRange, type ChartName } from "@/lib/insights";
import { csvFile } from "@/lib/csv";

/** Story 6: one Insights chart as a CSV file (the same cohorts the person sees on the page). */
export async function GET(request: Request) {
  const ctx = await requireRole(["ADMIN", "INSTRUCTOR"]);
  const params = new URL(request.url).searchParams;
  const chart = (CHARTS as string[]).includes(params.get("chart") ?? "") ? (params.get("chart") as ChartName) : "cohorts";
  const range = parseRange(params.get("range"));
  const table = insightTables(await loadInsights(ctx, range))[chart];
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csvFile([table.head, ...table.rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="insights-${chart}-${range === "all" ? "all" : `${range}-weeks`}-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
