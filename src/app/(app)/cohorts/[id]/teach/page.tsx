import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireTeachableCohort } from "@/lib/access";
import { cohortRows } from "@/lib/cohort-stats";
import { expectedGroupPct, OTHER_GROUP } from "@/lib/progress";
import { isLesson } from "@/lib/coverage";
import { PageHeader, ProgressBar, Stat, Badge, LevelPill, Tag, KindPill } from "@/components/ui";
import { PlanLineNote, TaughtLearned, TeachBadge } from "@/components/progress";
import { MarkTaughtButton, TeachProvider } from "@/components/teach-controls";
import { fmtDate, pct, plural } from "@/lib/utils";

export const metadata = { title: "Teaching plan" };

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());

export default async function TeachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cohort } = await requireTeachableCohort(id);
  const [track, { tree, stages, coverage, taught, expected, expectedStages }] = await Promise.all([
    db.query.tracks.findFirst({ where: eq(schema.tracks.id, cohort.trackId) }).then((t) => t!),
    cohortRows(cohort),
  ]);
  const next = coverage.next;
  const nextLabel = next
    ? `Stage ${next.stageIndex + 1} · ${next.groupIndex !== null ? coverage.stages[next.stageIndex].groups[next.groupIndex].name : tree[next.stageIndex].title}`
    : null;

  return (
    <>
      <PageHeader
        title="Teaching plan"
        sub={<>{cohort.name} · {track.title} · started {fmtDate(cohort.startDate)}</>}
        back={{ href: `/cohorts/${cohort.id}`, label: cohort.name }}
        actions={<a href={`/cohorts/${cohort.id}/export?type=plan`} className="btn-ghost">Export teaching plan</a>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="card p-4 sm:col-span-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-ink-muted">Taught so far</span>
            <span className="text-2xl font-bold">{pct(coverage.pct)}</span>
          </div>
          <div className="mt-3"><ProgressBar value={coverage.pct} expected={expected} label="Taught so far" /></div>
          <p className="mt-2 text-sm">{coverage.taught} of {plural(coverage.required, "lesson")} taught.</p>
          <div className="mt-1"><PlanLineNote who="your teaching" /></div>
        </div>
        <Stat label="Next to teach" value={<span className="text-base">{nextLabel ?? "Everything is taught"}</span>} />
        <div className="card p-4">
          <div className="text-sm font-semibold text-ink-muted">Behind the plan</div>
          <div className="mt-1 text-2xl font-bold">{coverage.behind}</div>
          <div className="mt-1">
            {coverage.behind ? <Badge tone="warning" icon="offline">{plural(coverage.behind, "week")} past their date</Badge> : <Badge tone="success" icon="check">On plan</Badge>}
          </div>
        </div>
      </div>

      <TeachProvider cohortId={cohort.id} today={todayIso()}>
        <div className="space-y-3">
          {tree.map((stage, i) => {
            const cov = coverage.stages[i];
            const learned = stages[i];
            const lessons = stage.items.filter((it) => isLesson(it.kind));
            const untaught = (ids: { id: string }[]) => ids.filter((it) => !taught.has(it.id)).map((it) => it.id);
            const blocks = cov.groups.length
              ? cov.groups.map((g, gi) => ({ name: g.name as string | null, gi, items: stage.items.filter((it) => (it.group ?? OTHER_GROUP) === g.name) }))
              : [{ name: null, gi: -1, items: stage.items }];
            return (
              <details key={stage.id} className="card" open={i === next?.stageIndex}>
                <summary className="flex cursor-pointer list-none flex-col gap-3 p-4">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{i + 1}. {stage.title}</span>
                    <LevelPill level={stage.level} />
                    {stage.optional && <Tag>Choose one</Tag>}
                    <TeachBadge status={cov.status} on={cov.lastTaughtOn} />
                  </span>
                  <TaughtLearned taught={cov} learned={learned.avg} expected={expectedStages[i]} />
                </summary>
                <div className="border-t border-border p-4">
                  {lessons.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      <MarkTaughtButton itemIds={untaught(lessons)} label="Mark whole stage taught" />
                    </div>
                  )}
                  {blocks.map((b) => {
                    const g = b.gi >= 0 ? cov.groups[b.gi] : null;
                    const groupLessons = b.items.filter((it) => isLesson(it.kind));
                    return (
                      <div key={b.name ?? "all"} className="mt-3">
                        {g && (
                          <div className="mb-2 grid gap-2 rounded-md bg-surface-sunken p-3">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{g.name}</span>
                              <TeachBadge status={g.status} on={g.lastTaughtOn} />
                              <span className="ml-auto"><MarkTaughtButton itemIds={untaught(groupLessons)} label="Mark week taught" small /></span>
                            </span>
                            <TaughtLearned taught={g} learned={learned.groups[b.gi]?.avg ?? 0}
                              expected={expectedGroupPct(expectedStages[i], b.gi, cov.groups.length)} />
                          </div>
                        )}
                        <ul className="divide-y divide-border">
                          {b.items.map((it) => {
                            const t = taught.get(it.id);
                            return (
                              <li key={it.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                                <span className="min-w-0 flex-1">
                                  <span className={isLesson(it.kind) ? "font-medium" : "text-ink-muted"}>{it.title}</span> <KindPill kind={it.kind} />
                                  {it.optional && <> <Tag>Optional</Tag></>}
                                  {!isLesson(it.kind) && <span className="block text-xs text-ink-muted">Student work: check it in <Link className="text-secondary underline" href={`/cohorts/${cohort.id}/review`}>Review</Link>.</span>}
                                </span>
                                {isLesson(it.kind) && (t
                                  ? <>
                                      <Badge tone="success" icon="check">Taught · {fmtDate(t.taughtOn)}{t.by ? ` · ${t.by}` : ""}</Badge>
                                      <MarkTaughtButton itemIds={[it.id]} label="Undo" undo small />
                                    </>
                                  : <MarkTaughtButton itemIds={[it.id]} label="Mark taught" small />)}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </TeachProvider>
    </>
  );
}
