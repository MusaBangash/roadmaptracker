import { redirect } from "next/navigation";
import { requireVisibleTrack } from "@/lib/access";
import { canCopyTrack, canEditTrack } from "@/lib/access-core";
import { copyRoadmapAction } from "@/app/actions/roadmap";
import { loadTrackTree, stageWindows } from "@/lib/progress";
import { schoolTrackStages, myTrackProgress, cohortsUsingTrack } from "@/lib/cohort-stats";
import { ClassStageList, SegmentBar } from "@/components/progress";
import { Icon } from "@/components/icon";
import { pct, plural } from "@/lib/utils";
import Link from "next/link";
import { PageHeader, Badge } from "@/components/ui";
import { RoadmapOutline } from "@/components/roadmap-outline";

export const metadata = { title: "Track" };

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireVisibleTrack(slug);
  const { track } = ctx;
  const viewer = { userId: ctx.user.id, orgId: ctx.org?.id ?? null, role: ctx.role };
  const editable = canEditTrack(viewer, track);
  // A school roadmap never published has nothing to show yet: its admins go to the builder.
  if (track.status === "DRAFT") redirect(`/tracks/${track.slug}/edit`);
  const tree = await loadTrackTree(track.id);
  const { windows, total: weeks } = stageWindows(tree);
  const staff = ctx.role === "ADMIN" || ctx.role === "INSTRUCTOR";
  const [school, mine, cohorts] = ctx.org
    ? await Promise.all([staff ? schoolTrackStages(ctx.org.id, tree, track.id) : null, myTrackProgress(ctx.org.id, ctx.user.id),
      staff ? cohortsUsingTrack(ctx.org.id, track.id) : null])
    : [null, new Map<string, { enrollmentId: string; pct: number }>(), null];
  const items = tree.flatMap((s) => s.items);
  const lessons = items.filter((i) => i.kind === "LESSON").length;
  const summary: [string, number][] = [
    ["Stages", tree.length], ["Weeks", weeks], ["Lessons", lessons], ["Work to check", items.length - lessons],
    ...(cohorts !== null ? [["Cohorts using it", cohorts] as [string, number]] : []),
  ];
  const me = mine.get(track.id);
  return (
    <>
      <PageHeader title={track.title} back={{ href: "/tracks", label: "Tracks" }}
        sub={<span className="flex flex-wrap items-center gap-2">
          {track.ownerOrgId && <Badge tone="info" icon="home">Your school&apos;s roadmap</Badge>}
          {track.ownerOrgId && track.draft && editable && <Badge tone="warning" icon="edit">Unpublished changes</Badge>}
          <span>{track.subtitle}{weeks ? ` · about ${weeks} weeks` : ""}</span>
        </span>}
        actions={<>
          {me && <Link href={`/learn/${me.enrollmentId}`} className="btn-primary">Open my roadmap</Link>}
          {editable && <Link href={`/tracks/${track.slug}/edit`} className="btn-primary"><Icon name="edit" size={18} />Edit roadmap</Link>}
          {staff && <Link href={`/tracks/${track.slug}/preview`} className="btn-ghost"><Icon name="computer" size={18} />Preview as student</Link>}
          {canCopyTrack(viewer, track) && (
            <form action={copyRoadmapAction}>
              <input type="hidden" name="trackId" value={track.id} />
              <button className="btn-ghost"><Icon name="copy" size={18} />Copy to my school</button>
            </form>
          )}
          {(ctx.role === "ADMIN" || ctx.user.isSuperAdmin) && <a href={`/tracks/${track.slug}/download`} className="btn-ghost"><Icon name="download" size={18} />Download file</a>}
        </>} />
      {ctx.role === "ADMIN" && !track.ownerOrgId && (
        <p className="mb-6 text-sm text-ink-muted">This is an official NoorAI roadmap, kept the same for every school. To change it for your school, press <b>Copy to my school</b> and edit the copy.</p>
      )}
      <dl className={`card mb-6 grid grid-cols-2 gap-px overflow-hidden bg-border ${summary.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
        {summary.map(([label, n]) => (
          <div key={label} className="bg-surface-raised p-3 last:odd:col-span-2 sm:p-4 sm:last:odd:col-span-1">
            <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
            <dd className="mt-0.5 text-2xl font-bold text-ink">{n}</dd>
          </div>
        ))}
      </dl>
      {me && <div className="card mb-6 p-4"><SegmentBar label="Your progress" value={me.pct} strong /></div>}
      {school && school.students > 0 && (
        <section className="mb-8">
          <h2 className="h2 mb-1">How your school is doing</h2>
          <p className="mb-3 text-sm text-ink-muted">
            {plural(school.students, "active student")} across your open cohorts · average {pct(school.avg)}. Open a stage to see its weeks.
          </p>
          <ClassStageList tree={tree} stages={school.stages} averageLabel="School average" />
        </section>
      )}
      <h2 className="h2 mb-3">What is in this roadmap</h2>
      {track.expert && <p className="card mb-6 p-4 text-sm"><b className="text-primary">What “expert” means here:</b> {track.expert}</p>}
      {track.benchmarks.length > 0 && (
        <section className="mb-6">
          <h2 className="h2 mb-3">How you know you&apos;re at that level</h2>
          <div className="card divide-y divide-border">
            {track.benchmarks.map((b) => <div key={b.title} className="grid gap-1 p-3 text-sm sm:grid-cols-[200px_1fr]"><b>{b.title}</b><span>{b.detail}</span></div>)}
          </div>
        </section>
      )}
      <RoadmapOutline stages={tree.map((s, i) => ({
        id: s.id, title: s.title, level: s.level, weeks: s.weeks, optional: s.optional, choiceGroup: s.choiceGroup,
        benchmark: s.benchmark, doneWhen: s.doneWhen, start: windows[i].start,
        items: s.items.map((it) => ({ id: it.id, title: it.title, detail: it.detail, kind: it.kind, optional: it.optional })),
      }))} />
    </>
  );
}
