import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwnEnrollment } from "@/lib/access";
import { loadTrackTree, loadProgress, summarize, expectedPct } from "@/lib/progress";
import { PageHeader, ProgressBar, LevelPill, Stat } from "@/components/ui";
import { ItemRow } from "@/components/item-row";
import { pct } from "@/lib/utils";

export const metadata = { title: "My track" };

export default async function LearnPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const { enrollment } = await requireOwnEnrollment(enrollmentId);
  const cohort = (await db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, enrollment.cohortId) }))!;
  const track = (await db.query.tracks.findFirst({ where: eq(schema.tracks.id, cohort.trackId) }))!;
  const tree = await loadTrackTree(track.id);
  const { progress, signoffs } = await loadProgress([enrollment.id]);
  const sum = summarize(tree, progress, signoffs);
  const expected = expectedPct(tree, cohort.startDate);
  const byItem = new Map(progress.map((p) => [p.itemId, p]));
  const firstOpen = sum.stages.findIndex((s) => s.signedOff !== true && s.pct < 1);

  return (
    <>
      <PageHeader
        title={track.title}
        sub={<>{cohort.name}{track.edition ? ` · ${track.edition}` : ""}</>}
        back={{ href: "/dashboard", label: "Dashboard" }}
        actions={<Link href={`/learn/${enrollment.id}/log`} className="btn-ghost">Weekly log</Link>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card col-span-2 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Overall progress</span>
            <span className="font-bold text-2xl">{pct(sum.pct)}</span>
          </div>
          <div className="mt-3"><ProgressBar value={sum.pct} expected={expected} /></div>
          <p className="mt-2 text-xs text-ink-muted">The line marks where the cohort plan expects you to be today ({pct(expected)}).</p>
        </div>
        <Stat label="Done" value={`${sum.done}/${sum.required}`} sub="lessons and projects" />
        <Stat label="Stages passed" value={`${sum.stagesPassed}/${tree.length}`} sub={`${sum.verified} ${sum.verified === 1 ? "item" : "items"} verified`} />
      </div>

      <div className="space-y-3">
        {tree.map((stage, i) => {
          const s = sum.stages[i];
          const groups: { name: string | null; items: typeof stage.items }[] = [];
          for (const it of stage.items) {
            const last = groups[groups.length - 1];
            if (last && last.name === it.group) last.items.push(it);
            else groups.push({ name: it.group, items: [it] });
          }
          return (
            <details key={stage.id} className="card group" open={i === firstOpen}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-on-primary">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{stage.title}</span>
                    <LevelPill level={stage.level} />
                    {stage.optional && <span className="pill bg-surface-sunken text-ink-muted">choose one</span>}
                    {s.signedOff === true && <span className="pill bg-primary-soft text-primary">✓ signed off</span>}
                    {s.signedOff === false && <span className="pill bg-danger-soft text-danger">not passed yet</span>}
                  </span>
                  <span className="mt-2 block max-w-md"><ProgressBar value={s.pct} /></span>
                </span>
                <span className="text-sm text-ink-muted">{s.done}/{s.required}{stage.weeks ? ` · ~${stage.weeks} wk` : ""}</span>
              </summary>
              <div className="border-t border-border px-4 pb-4 pt-3">
                <dl className="mb-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[120px_1fr]">
                  {stage.benchmark && (<><dt className="font-semibold text-ink-muted">Benchmark</dt><dd>{stage.benchmark}</dd></>)}
                  {stage.goal && (<><dt className="font-semibold text-ink-muted">Goal</dt><dd>{stage.goal}</dd></>)}
                  {stage.doneWhen && (<><dt className="font-semibold text-highlight-text">Done when</dt><dd className="font-semibold">{stage.doneWhen}</dd></>)}
                  {stage.resources && (<><dt className="font-semibold text-ink-muted">Resources</dt><dd className="text-ink-muted">{stage.resources}</dd></>)}
                </dl>
                {groups.map((g, gi) => (
                  <div key={gi} className="mt-2">
                    {g.name && <h3 className="mb-1 mt-3 text-sm font-bold text-primary">{g.name}</h3>}
                    <ul>
                      {g.items.map((it) => {
                        const p = byItem.get(it.id);
                        return (
                          <ItemRow key={it.id} enrollmentId={enrollment.id}
                            item={{ id: it.id, title: it.title, detail: it.detail, kind: it.kind, optional: it.optional }}
                            progress={p ? { status: p.status, evidenceUrl: p.evidenceUrl, note: p.note, reviewNote: p.reviewNote } : null} />
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
