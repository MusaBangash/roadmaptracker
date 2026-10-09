import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/access";
import { loadTrackTree, stageWindows } from "@/lib/progress";
import { schoolTrackStages, myTrackProgress } from "@/lib/cohort-stats";
import { ClassStageList, SegmentBar } from "@/components/progress";
import { Icon } from "@/components/icon";
import { pct, plural } from "@/lib/utils";
import Link from "next/link";
import { PageHeader, LevelPill, KindPill } from "@/components/ui";

export const metadata = { title: "Track" };

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getContext();
  const track = await db.query.tracks.findFirst({ where: eq(schema.tracks.slug, slug) });
  if (!track) notFound();
  const tree = await loadTrackTree(track.id);
  const { total: weeks } = stageWindows(tree);
  const staff = ctx.role === "ADMIN" || ctx.role === "INSTRUCTOR";
  const [school, mine] = ctx.org
    ? await Promise.all([staff ? schoolTrackStages(ctx.org.id, tree, track.id) : null, myTrackProgress(ctx.org.id, ctx.user.id)])
    : [null, new Map<string, { enrollmentId: string; pct: number }>()];
  const me = mine.get(track.id);
  return (
    <>
      <PageHeader title={track.title} sub={<>{track.subtitle}{weeks ? ` · about ${weeks} weeks` : ""}</>} back={{ href: "/tracks", label: "Tracks" }}
        actions={<>
          {me && <Link href={`/learn/${me.enrollmentId}`} className="btn-primary">Open my roadmap</Link>}
          {staff && <Link href={`/tracks/${track.slug}/preview`} className="btn-ghost"><Icon name="computer" size={18} />Preview as student</Link>}
        </>} />
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
      <div className="space-y-3">
        {tree.map((s, i) => (
          <details key={s.id} className="card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4">
              <span className="font-semibold">{i + 1}. {s.title}</span><LevelPill level={s.level} />
              <span className="ml-auto text-sm text-ink-muted">{s.items.length} items{s.weeks ? ` · ~${s.weeks} wk` : ""}</span>
            </summary>
            <div className="border-t border-border p-4 text-sm">
              {s.benchmark && <p><b className="text-ink-muted">Benchmark:</b> {s.benchmark}</p>}
              {s.doneWhen && <p className="mt-1"><b className="text-highlight-text">Done when:</b> {s.doneWhen}</p>}
              <ul className="mt-3 space-y-1">
                {s.items.map((it) => <li key={it.id}><span className="font-medium">{it.title}</span> <KindPill kind={it.kind} />{it.detail && <span className="text-ink-muted"> — {it.detail}</span>}</li>)}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
