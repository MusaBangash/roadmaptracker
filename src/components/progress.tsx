import { Badge, LevelPill, ProgressBar, SignoffBadge, Tag } from "@/components/ui";
import { BEHIND_BY, REVIEW_KINDS, expectedGroupPct, type ClassPart, type ClassStage, type Part, type StageSummary } from "@/lib/progress-core";
import { pct, plural } from "@/lib/utils";

// Progress bars for every level of a roadmap: the whole track, each stage, and each week
// (or lessons and projects) inside a stage. Used by students, instructors and admins alike.

type StageMeta = { title: string; level: string; optional: boolean; weeks: number };
const isReviewKind = (kind: string) => (REVIEW_KINDS as readonly string[]).includes(kind);

/** A labelled bar: the name on the left, the numbers on the right. */
export function SegmentBar({ label, value, expected, detail, strong = false }: {
  label: React.ReactNode; value: number; expected?: number; detail?: React.ReactNode; strong?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={`min-w-0 ${strong ? "font-semibold" : ""}`}>{label}</span>
        <span className="shrink-0 tabular-nums text-ink-muted">{detail ?? pct(value)}</span>
      </div>
      <div className="mt-1"><ProgressBar value={value} expected={expected} label={typeof label === "string" ? label : undefined} /></div>
    </div>
  );
}

const count = (p: Part) => `${p.done} of ${p.required} · ${pct(p.pct)}`;

/** True when a stage is more than BEHIND_BY behind where the plan expects it today. */
export const isBehind = (value: number, expected: number | undefined, signedOff?: boolean | null) =>
  expected !== undefined && signedOff !== true && value + BEHIND_BY < expected;

/** The closed view of one stage for one student: title, statuses and its bar. */
export function StageLine({ index, stage, s, expected, here = false }: {
  index: number; stage: StageMeta; s: StageSummary; expected?: number; here?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-on-primary">{index + 1}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{stage.title}</span>
          <LevelPill level={stage.level} />
          {stage.optional && <Tag>Choose one</Tag>}
          {here && <Badge tone="info" icon="home">You are here</Badge>}
          <SignoffBadge passed={s.signedOff} />
          {isBehind(s.pct, expected, s.signedOff) && <Badge tone="warning" icon="offline">Behind plan</Badge>}
        </span>
        <span className="mt-2 block">
          <SegmentBar
            label={stage.weeks ? `About ${plural(stage.weeks, "week")}` : "Progress"}
            value={s.pct}
            expected={expected}
            detail={s.required ? count(s) : "Nothing required"}
          />
        </span>
      </span>
    </span>
  );
}

/** Inside a stage without weeks: separate bars for lessons and for projects. */
export function KindBars({ s }: { s: StageSummary }) {
  if (!s.lessons.required || !s.projects.required) return null;
  return (
    <div className="mb-4 grid gap-3 rounded-md bg-surface-sunken p-3 sm:grid-cols-2">
      <SegmentBar label="Lessons" value={s.lessons.pct} detail={count(s.lessons)} />
      <SegmentBar label="Projects" value={s.projects.pct} detail={count(s.projects)} />
    </div>
  );
}

/** The bar shown at the top of one week (group) inside a stage. */
export function GroupBar({ s, groupIndex, stageExpected }: { s: StageSummary; groupIndex: number; stageExpected?: number }) {
  const g = s.groups[groupIndex];
  if (!g) return null;
  const expected = stageExpected === undefined ? undefined : expectedGroupPct(stageExpected, groupIndex, s.groups.length);
  return <SegmentBar label={g.name} value={g.pct} expected={expected} detail={count(g)} strong />;
}

/** Explains the line on the bars, in words (nothing needs hover to be understood). */
export function PlanLineNote({ who = "you" }: { who?: string }) {
  return (
    <p className="flex items-center gap-2 text-xs text-ink-muted">
      <span className="inline-block h-3 w-0.5 bg-ink/50" aria-hidden />
      The line on a bar marks where the cohort plan expects {who} to be today.
    </p>
  );
}

const classDetail = (p: ClassPart, unit = "student") => p.students ? `average ${pct(p.avg)} · ${plural(p.students, unit)}` : "no students yet";

/** The whole class (or school) at every level: one row per stage, opening to its weeks. */
export function ClassStageList({ tree, stages, expectedStages, open, averageLabel = "Class average" }: {
  tree: (StageMeta & { id: string; items: { kind: string; optional: boolean }[] })[]; stages: ClassStage[]; expectedStages?: number[]; open?: number;
  averageLabel?: string;
}) {
  return (
    <div className="card divide-y divide-border">
      {tree.map((stage, i) => {
        const c = stages[i];
        const expected = expectedStages?.[i];
        const required = stage.items.filter((it) => !it.optional);
        const hasKinds = required.some((it) => !isReviewKind(it.kind)) && required.some((it) => isReviewKind(it.kind));
        const hasInside = c.groups.length > 0 || hasKinds;
        return (
          <details key={stage.id} className="group p-4" open={i === open}>
            <summary className="flex cursor-pointer list-none flex-col gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{i + 1}. {stage.title}</span>
                <LevelPill level={stage.level} />
                {stage.optional && <Tag>Choose one</Tag>}
                {isBehind(c.avg, expected) && c.students > 0 && <Badge tone="warning" icon="offline">Behind plan</Badge>}
              </span>
              <SegmentBar label={stage.optional ? `${plural(c.students, "student")} chose this` : averageLabel} value={c.avg} expected={expected} detail={pct(c.avg)} />
              <span className="flex flex-wrap gap-x-4 text-xs text-ink-muted">
                <span>{c.finished} finished</span>
                <span>{c.signedOff} signed off</span>
                {hasInside && <span className="text-primary group-open:hidden">Show {c.groups.length ? "weeks" : "lessons and projects"}</span>}
              </span>
            </summary>
            {hasInside && (
              <div className="mt-3 grid gap-3 rounded-md bg-surface-sunken p-3 sm:grid-cols-2">
                {c.groups.length > 0
                  ? c.groups.map((g, gi) => (
                      <SegmentBar key={g.name} label={g.name} value={g.avg} detail={classDetail(g)}
                        expected={expected === undefined ? undefined : expectedGroupPct(expected, gi, c.groups.length)} />
                    ))
                  : (<>
                      <SegmentBar label="Lessons" value={c.lessons.avg} detail={classDetail(c.lessons)} />
                      <SegmentBar label="Projects" value={c.projects.avg} detail={classDetail(c.projects)} />
                    </>)}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
