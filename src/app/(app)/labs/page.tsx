import Link from "next/link";
import { requireRole } from "@/lib/access";
import { myLabs } from "@/lib/labs";
import { inspectionDue } from "@/lib/lab-core";
import { pakistanDay } from "@/lib/certificate-design-core";
import { PageHeader, Empty, Badge } from "@/components/ui";
import { Icon } from "@/components/icon";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Labs" };

/** Story 6: the labs this person looks after (admins: all), with how each is doing today. */
export default async function LabsPage() {
  const ctx = await requireRole(["ADMIN", "INSTRUCTOR"]);
  const labs = await myLabs(ctx);
  const today = pakistanDay(new Date());
  const admin = ctx.role === "ADMIN";
  return (
    <>
      <PageHeader title="Labs" sub={admin ? `${ctx.org.name} · every lab` : "The labs you look after"}
        actions={admin && <Link href="/labs/new" className="btn-primary"><Icon name="plus" size={18} />Add lab</Link>} />
      {labs.length === 0 ? (
        <Empty title={admin ? "No labs yet" : "No lab given to you yet"}>
          {admin ? "Add a lab: its PCs, what is checked on each, and the teachers who look after it." : "Ask your school admin to add you to a lab."}
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {labs.map((l) => {
            const due = inspectionDue(l.lastInspection, today);
            return (
              <Link key={l.id} href={`/labs/${l.id}`} className="card block p-4 hover:border-border-strong">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="h2">{l.name}</h2>
                  {due ? <Badge tone="warning" icon="clock">Inspection due</Badge> : <Badge tone="success" icon="check">Checked</Badge>}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-ink-muted">PCs working</dt><dd className="text-lg font-bold">{l.pcsWorking} / {l.pcCount}</dd></div>
                  <div><dt className="text-ink-muted">Open problems</dt>
                    <dd className={`text-lg font-bold ${l.openProblems ? "text-danger" : ""}`}>{l.openProblems}</dd></div>
                  <div className="col-span-2"><dt className="text-ink-muted">Last inspection</dt><dd>{l.lastInspection ? fmtDate(l.lastInspection) : "Never"}</dd></div>
                  {l.teachers.length > 0 && <div className="col-span-2"><dt className="text-ink-muted">Teachers</dt><dd className="truncate">{l.teachers.join(", ")}</dd></div>}
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
