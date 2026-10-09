import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwnEnrollment } from "@/lib/access";
import { loadTrackTree, loadProgress, summarize, expectedPct, expectedStagePcts } from "@/lib/progress";
import { PageHeader } from "@/components/ui";
import { RoadmapView } from "@/components/roadmap-view";
import { loadCoverage } from "@/lib/coverage";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "My track" };

export default async function LearnPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const { enrollment } = await requireOwnEnrollment(enrollmentId);
  const cohort = (await db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, enrollment.cohortId) }))!;
  const [track, tree, { progress, signoffs }, taught] = await Promise.all([
    db.query.tracks.findFirst({ where: eq(schema.tracks.id, cohort.trackId) }).then((t) => t!),
    loadTrackTree(cohort.trackId),
    loadProgress([enrollment.id]),
    loadCoverage(cohort.id),
  ]);

  return (
    <>
      <PageHeader
        title={track.title}
        sub={<>{cohort.name}{track.edition ? ` · ${track.edition}` : ""}</>}
        back={{ href: "/dashboard", label: "Dashboard" }}
        actions={<Link href={`/learn/${enrollment.id}/log`} className="btn-ghost">Weekly log</Link>}
      />
      <RoadmapView
        tree={tree}
        sum={summarize(tree, progress, signoffs)}
        expected={expectedPct(tree, cohort.startDate)}
        expectedStages={expectedStagePcts(tree, cohort.startDate)}
        progress={new Map(progress.map((p) => [p.itemId, { status: p.status, evidenceUrl: p.evidenceUrl, note: p.note, reviewNote: p.reviewNote, byTeacher: !!p.markedById }]))}
        taught={new Map([...taught].map(([itemId, t]) => [itemId, fmtDate(t.taughtOn)]))}
        enrollmentId={enrollment.id}
      />
    </>
  );
}
