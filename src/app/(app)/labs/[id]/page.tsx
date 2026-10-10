import Link from "next/link";
import { requireLabAccess } from "@/lib/access";
import { labInspectionList, labProblems, myLabs } from "@/lib/labs";
import { ROOM, STATUS_LABELS, inspectionDue, inspectionSummary } from "@/lib/lab-core";
import { pakistanDay } from "@/lib/certificate-design-core";
import { FixProblemForm, ReportProblemForm } from "@/components/lab-forms";
import { PageHeader, Badge, Stat } from "@/components/ui";
import { Icon } from "@/components/icon";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Lab" };

/** Stories 4–6: one lab — today's state, open problems (fix them here), report a problem, inspections. */
export default async function LabPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireLabAccess((await params).id);
  const lab = ctx.lab;
  const [open, fixed, inspections, [state]] = await Promise.all([
    labProblems(lab.id, "open"), labProblems(lab.id, "fixed"), labInspectionList(lab.id),
    myLabs(ctx, true).then((all) => all.filter((l) => l.id === lab.id)),
  ]);
  const due = inspectionDue(state?.lastInspection ?? null, pakistanDay(new Date()));
  return (
    <>
      <PageHeader title={lab.name} sub={<>{lab.pcCount} PCs{state?.teachers.length ? ` · ${state.teachers.join(", ")}` : ""}{lab.archived ? " · archived" : ""}</>}
        back={{ href: "/labs", label: "Labs" }}
        actions={<>
          <Link href={`/labs/${lab.id}/inspect`} className="btn-primary"><Icon name="check" size={18} />New inspection</Link>
          {ctx.role === "ADMIN" && <Link href={`/labs/${lab.id}/settings`} className="btn-ghost"><Icon name="edit" size={18} />Settings</Link>}
        </>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="PCs working" value={`${state?.pcsWorking ?? lab.pcCount} / ${lab.pcCount}`} />
        <Stat label="Open problems" value={open.length} />
        <Stat label="Last inspection" value={state?.lastInspection ? fmtDate(state.lastInspection) : "Never"} sub={due ? "Inspection due" : undefined} />
      </div>

      <section className="mb-8" aria-labelledby="open-h">
        <h2 id="open-h" className="h2 mb-3">Open problems ({open.length})</h2>
        {open.length === 0 ? <p className="text-sm text-ink-muted">Nothing open. Everything works.</p> : (
          <ul className="card divide-y divide-border">
            {open.map(({ f, reporter }) => (
              <li key={f.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_minmax(16rem,22rem)] sm:items-center">
                <div className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{f.station === ROOM ? "Room" : f.station} · {f.item}</b>
                    <Badge tone="danger" icon="error">{STATUS_LABELS[f.status]}</Badge>
                  </div>
                  {f.note && <div className="mt-1" dir="auto">{f.note}</div>}
                  <div className="mt-1 text-xs text-ink-muted">Since {fmtDate(f.reportedAt)} · {reporter ?? "Deleted person"}</div>
                </div>
                <FixProblemForm faultId={f.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {!lab.archived && (
        <details className="card mb-8 p-4" id="report">
          <summary className="cursor-pointer font-semibold">Report a problem</summary>
          <p className="my-2 text-sm text-ink-muted">Something broke between inspections? Add it now; it stays open until someone marks it fixed.</p>
          <ReportProblemForm lab={lab} />
        </details>
      )}

      <section className="mb-8" aria-labelledby="ins-h">
        <h2 id="ins-h" className="h2 mb-3">Inspections</h2>
        {inspections.length === 0 ? <p className="text-sm text-ink-muted">No inspection yet. Press <b>New inspection</b> to do the first.</p> : (
          <ul className="card divide-y divide-border">
            {inspections.map(({ i, by }) => {
              const s = inspectionSummary(i, i.findings);
              return (
                <li key={i.id}>
                  <Link href={`/labs/${lab.id}/inspections/${i.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-surface-sunken">
                    <span><b>{fmtDate(i.inspectedOn)}</b> · {by ?? "Deleted person"}</span>
                    <span className="text-ink-muted">{s.pcsWorking}/{s.pcCount} PCs working · {s.problems} {s.problems === 1 ? "problem" : "problems"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {fixed.length > 0 && (
        <details className="mb-8">
          <summary className="cursor-pointer font-semibold">Recently fixed ({fixed.length})</summary>
          <ul className="card mt-3 divide-y divide-border text-sm">
            {fixed.map(({ f, fixer }) => (
              <li key={f.id} className="p-3">
                <b>{f.station === ROOM ? "Room" : f.station} · {f.item}</b> <span className="text-ink-muted">was {STATUS_LABELS[f.status].toLowerCase()}</span>
                <div className="text-xs text-ink-muted">Fixed {fmtDate(f.fixedAt)} · {fixer ?? "Deleted person"}{f.fixNote ? ` · ${f.fixNote}` : ""}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
