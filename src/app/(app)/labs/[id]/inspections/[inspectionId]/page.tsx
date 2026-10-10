import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireLabAccess } from "@/lib/access";
import { ROOM, STATUS_LABELS, cellKey, inspectionSummary, stations } from "@/lib/lab-core";
import { PrintButton } from "@/components/certificate-tools";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Inspection report" };

/** Story 3: one inspection as a report, like the school's Word report but always consistent: the lab's
 *  name, date and people come from the app; problems are listed with what still needs fixing. */
export default async function InspectionReportPage({ params }: { params: Promise<{ id: string; inspectionId: string }> }) {
  const { id, inspectionId } = await params;
  const ctx = await requireLabAccess(id);
  const [row] = await db.select({ i: schema.labInspections, by: sql<string | null>`(select coalesce("name", "email") from "user" where "user"."id" = "lab_inspection"."by_id")` })
    .from(schema.labInspections).where(and(eq(schema.labInspections.id, inspectionId), eq(schema.labInspections.labId, ctx.lab.id)));
  if (!row) notFound();
  const { i, by } = row;
  const s = inspectionSummary(i, i.findings);
  const found = new Map(i.findings.map((f) => [cellKey(f.station, f.item), f]));
  const pcs = stations(i.pcCount);
  const cell = (station: string, item: string) => found.get(cellKey(station, item));
  const remarks = (station: string) => i.findings.filter((f) => f.station === station).map((f) => `${f.item}: ${STATUS_LABELS[f.status].toLowerCase()}${f.note ? ` (${f.note})` : ""}`).join("; ");

  return (
    <>
      <style>{"@page { size: A4 portrait; margin: 12mm; }"}</style>
      <div className="print:hidden">
        <PageHeader title="Inspection report" sub={`${i.labName} · ${fmtDate(i.inspectedOn)}`} back={{ href: `/labs/${ctx.lab.id}`, label: ctx.lab.name }}
          actions={<>
            <PrintButton label="Print" />
            <a href={`/labs/${ctx.lab.id}/inspections/${i.id}/export`} className="btn-ghost"><Icon name="download" size={18} />Download for Excel</a>
          </>} />
      </div>

      {/* The report itself: black on white on paper, even in dark mode. */}
      <article className="card mx-auto max-w-4xl p-5 print:max-w-none print:border-0 print:bg-white print:p-0 print:text-black print:shadow-none">
        <header className="mb-5 text-center">
          <div className="text-lg font-bold">{ctx.org.name}</div>
          <div className="text-base font-semibold">{i.labName}</div>
          <h1 className="mt-1 text-xl font-bold">Computer Laboratory Inspection &amp; Equipment Report</h1>
          <p className="text-sm">Date: <b>{fmtDate(i.inspectedOn)}</b> · Inspected by: <b>{by ?? "Deleted person"}</b></p>
        </header>

        <h2 className="mb-2 font-bold">1. Summary</h2>
        <table className="report mb-5 w-full border-collapse text-sm">
          <thead><tr><th>Equipment</th><th>Checked</th><th>Working</th><th>Status</th></tr></thead>
          <tbody>
            {i.pcCount > 0 && (
              <tr><td>Computer workstations ({pcs[0]}–{pcs.at(-1)})</td><td>{i.pcCount}</td><td>{s.pcsWorking}</td>
                <td>{s.pcsWorking === i.pcCount ? "✓ All working" : `✗ ${i.pcCount - s.pcsWorking} with problems`}</td></tr>
            )}
            {i.roomItems.map((item) => {
              const f = cell(ROOM, item);
              return <tr key={item}><td>{item}</td><td>1</td><td>{f ? 0 : 1}</td><td>{f ? `✗ ${STATUS_LABELS[f.status]}` : "✓ Working"}</td></tr>;
            })}
          </tbody>
        </table>

        {i.pcCount > 0 && (
          <>
            <h2 className="mb-2 font-bold">2. Computer workstation checklist</h2>
            <p className="mb-2 text-sm">✓ = present and working. Problems are named in the box.</p>
            <div className="mb-5 overflow-x-auto print:overflow-visible">
              <table className="report w-full border-collapse text-sm print:text-[9pt]">
                <thead><tr><th>PC</th>{i.pcItems.map((it) => <th key={it}>{it}</th>)}<th>Overall</th><th>Remarks</th></tr></thead>
                <tbody>
                  {pcs.map((pc) => {
                    const bad = i.pcItems.some((it) => cell(pc, it));
                    return (
                      <tr key={pc}>
                        <th scope="row" className="whitespace-nowrap">{pc}</th>
                        {i.pcItems.map((it) => {
                          const f = cell(pc, it);
                          return <td key={it} className={`text-center ${f ? "font-semibold text-danger print:text-black" : ""}`}>{f ? STATUS_LABELS[f.status] : "✓"}</td>;
                        })}
                        <td className="whitespace-nowrap">{bad ? "✗ Problem" : "✓ Working"}</td>
                        <td className="min-w-40" dir="auto">{remarks(pc)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {i.roomItems.length > 0 && (
          <>
            <h2 className="mb-2 font-bold">{i.pcCount > 0 ? "3." : "2."} Room equipment</h2>
            <table className="report mb-5 w-full border-collapse text-sm">
              <thead><tr><th>Equipment</th><th>Result</th><th>Remarks</th></tr></thead>
              <tbody>
                {i.roomItems.map((item) => {
                  const f = cell(ROOM, item);
                  return <tr key={item}><td>{item}</td><td>{f ? `✗ ${STATUS_LABELS[f.status]}` : "✓ Working"}</td><td dir="auto">{f?.note ?? ""}</td></tr>;
                })}
              </tbody>
            </table>
          </>
        )}

        <h2 className="mb-2 font-bold">Problems found ({s.problems})</h2>
        {s.problems === 0 ? <p className="mb-5 text-sm">None. Every item was present and working.</p> : (
          <ul className="mb-5 list-disc ps-5 text-sm">
            {i.findings.map((f) => <li key={cellKey(f.station, f.item)}><b>{f.station === ROOM ? "Room" : f.station} · {f.item}</b>: {STATUS_LABELS[f.status]}{f.note ? `, ${f.note}` : ""}</li>)}
          </ul>
        )}
        {i.note && <p className="mb-5 text-sm"><b>Remarks:</b> <span dir="auto">{i.note}</span></p>}

        <div className="mt-12 grid grid-cols-2 gap-16 text-sm">
          <div className="border-t border-current pt-1">Inspected by: {by ?? ""}</div>
          <div className="border-t border-current pt-1">Checked by (principal / admin)</div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-muted print:text-black">{i.labName} · Inspection report · {fmtDate(i.inspectedOn)}</p>
      </article>
    </>
  );
}
