import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireTeachableCohort } from "@/lib/access";
import { REVIEW_KINDS } from "@/lib/progress";
import { reviewItemAction } from "@/app/actions/teach";
import { PageHeader, Empty, KindPill } from "@/components/ui";
import { daysAgo } from "@/lib/utils";

export const metadata = { title: "Review" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cohort } = await requireTeachableCohort(id);
  const rows = await db
    .select({ p: schema.itemProgress, i: schema.items, s: schema.stages, u: { name: schema.users.name, email: schema.users.email } })
    .from(schema.itemProgress)
    .innerJoin(schema.items, eq(schema.itemProgress.itemId, schema.items.id))
    .innerJoin(schema.stages, eq(schema.items.stageId, schema.stages.id))
    .innerJoin(schema.enrollments, eq(schema.itemProgress.enrollmentId, schema.enrollments.id))
    .innerJoin(schema.users, eq(schema.enrollments.userId, schema.users.id))
    .where(and(eq(schema.enrollments.cohortId, cohort.id), eq(schema.itemProgress.status, "DONE"), inArray(schema.items.kind, [...REVIEW_KINDS])))
    .orderBy(asc(schema.itemProgress.updatedAt));

  return (
    <>
      <PageHeader title="Review queue" sub={`${cohort.name} · ${rows.length} waiting · oldest first`} back={{ href: `/cohorts/${cohort.id}`, label: cohort.name }} />
      {rows.length === 0 ? <Empty title="Nothing to review">When students mark projects, deliverables or milestones as done, they appear here.</Empty> : (
        <div className="space-y-3">
          {rows.map(({ p, i, s, u }) => (
            <div key={p.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{i.title}</span><KindPill kind={i.kind} /></div>
                  <div className="text-sm text-ink-muted">{s.title}{i.group ? ` · ${i.group}` : ""}</div>
                  {i.detail && <div className="mt-1 text-sm text-ink-muted">{i.detail}</div>}
                </div>
                <div className="text-right text-sm">
                  <Link href={`/cohorts/${cohort.id}/students/${p.enrollmentId}`} className="font-semibold text-primary hover:underline">{u.name ?? u.email}</Link>
                  <div className="text-xs text-ink-muted">submitted {daysAgo(p.updatedAt)}</div>
                </div>
              </div>
              <div className="mt-3 rounded-md bg-surface-sunken p-3 text-sm">
                {p.evidenceUrl ? <a href={p.evidenceUrl} target="_blank" rel="noreferrer" className="break-all text-secondary underline">{p.evidenceUrl}</a> : <span className="text-ink-muted">No link attached.</span>}
                {p.note && <p className="mt-1">{p.note}</p>}
              </div>
              <form action={reviewItemAction} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="enrollmentId" value={p.enrollmentId} />
                <input type="hidden" name="itemId" value={p.itemId} />
                <input name="reviewNote" placeholder="Feedback for the student (needed if sending back)" className="input min-w-0 flex-1" />
                <button name="decision" value="VERIFIED" className="btn-primary">✓ Verify</button>
                <button name="decision" value="NEEDS_WORK" className="btn-danger">Needs work</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
