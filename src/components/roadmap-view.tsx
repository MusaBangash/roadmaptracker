import { ItemRow } from "@/components/item-row";
import { GroupBar, KindBars, PlanLineNote, StageLine } from "@/components/progress";
import { ProgressBar, Stat } from "@/components/ui";
import { currentStageIndex, type StageNode, type Summary } from "@/lib/progress";
import { pct } from "@/lib/utils";
import type { CommentView } from "@/lib/comments";
import { Fold } from "@/components/fold";

type ItemProgress = { status: string; evidenceUrl: string | null; note: string | null; reviewNote: string | null; byTeacher?: boolean };

/**
 * A roadmap as a student sees it: overall bar, then each stage with its bar, and inside it a
 * bar for every week (or for lessons and projects). Used by the student's own page and by
 * "Preview as student" (enrollmentId = null), so the preview is exactly what students get.
 */
export function RoadmapView({ tree, sum, expected, expectedStages, progress, enrollmentId, taught, threads }: {
  tree: StageNode[];
  sum: Summary;
  /** Plan position for the whole track and for each stage; left out in a preview. */
  expected?: number;
  expectedStages?: number[];
  progress: Map<string, ItemProgress>;
  enrollmentId: string | null;
  /** Lessons the teacher has taught this cohort: itemId → date, ready to show. */
  taught?: Map<string, string>;
  /** Comments per itemId, with the count the student hasn't read. */
  threads?: Map<string, { comments: CommentView[]; unread: number }>;
}) {
  const here = currentStageIndex(tree, sum);
  const hereStage = here >= 0 ? tree[here] : null;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card col-span-2 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-ink-muted">Overall progress</span>
            <span className="text-2xl font-bold">{pct(sum.pct)}</span>
          </div>
          <div className="mt-3"><ProgressBar value={sum.pct} expected={expected} label="Overall progress" /></div>
          <p className="mt-2 text-sm">
            {hereStage ? <>You are here: <b>Stage {here + 1} · {hereStage.title}</b></> : "Every required stage is done and signed off."}
          </p>
          {expected !== undefined && <div className="mt-1"><PlanLineNote /></div>}
        </div>
        <Stat label="Done" value={`${sum.done}/${sum.required}`} sub="required lessons and projects" />
        <Stat label="Stages passed" value={`${sum.stagesPassed}/${tree.length}`} sub={`${sum.verified} ${sum.verified === 1 ? "item" : "items"} verified`} />
      </div>

      <div className="space-y-3">
        {tree.map((stage, i) => {
          const s = sum.stages[i];
          const stageExpected = expectedStages?.[i];
          // Items in roadmap order, split where the week (group) changes.
          const blocks: { name: string | null; items: typeof stage.items }[] = [];
          for (const it of stage.items) {
            const last = blocks[blocks.length - 1];
            if (last && last.name === it.group) last.items.push(it);
            else blocks.push({ name: it.group, items: [it] });
          }
          const groupIndex = (name: string | null) => s.groups.findIndex((g) => g.name === name);
          return (
            <Fold key={stage.id} className="card" defaultOpen={i === here || stage.items.some((it) => (threads?.get(it.id)?.unread ?? 0) > 0)}>
              <summary className="flex cursor-pointer list-none p-4">
                <StageLine index={i} stage={stage} s={s} expected={stageExpected} here={i === here} />
              </summary>
              <div className="border-t border-border px-4 pb-4 pt-3">
                <dl className="mb-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[120px_1fr]">
                  {stage.benchmark && (<><dt className="font-semibold text-ink-muted">Benchmark</dt><dd>{stage.benchmark}</dd></>)}
                  {stage.goal && (<><dt className="font-semibold text-ink-muted">Goal</dt><dd>{stage.goal}</dd></>)}
                  {stage.doneWhen && (<><dt className="font-semibold text-highlight-text">Done when</dt><dd className="font-semibold">{stage.doneWhen}</dd></>)}
                  {stage.resources && (<><dt className="font-semibold text-ink-muted">Resources</dt><dd className="text-ink-muted">{stage.resources}</dd></>)}
                </dl>
                {s.groups.length === 0 && <KindBars s={s} />}
                {blocks.map((b, bi) => (
                  <div key={bi} className="mt-2">
                    {b.name && groupIndex(b.name) >= 0 && (
                      <div className="mb-1 mt-4 rounded-md bg-surface-sunken p-3">
                        <GroupBar s={s} groupIndex={groupIndex(b.name)} stageExpected={stageExpected} />
                      </div>
                    )}
                    <ul>
                      {b.items.map((it) => (
                        <ItemRow key={it.id} enrollmentId={enrollmentId}
                          item={{ id: it.id, title: it.title, detail: it.detail, kind: it.kind, optional: it.optional }}
                          progress={progress.get(it.id) ?? null} taughtOn={taught?.get(it.id) ?? null} thread={threads?.get(it.id) ?? null} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Fold>
          );
        })}
      </div>
    </>
  );
}
