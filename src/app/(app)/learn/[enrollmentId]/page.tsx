import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwnEnrollment } from "@/lib/access";
import { loadTrackTree, loadProgress, summarize, expectedPct, expectedStagePcts } from "@/lib/progress";
import { PageHeader } from "@/components/ui";
import { RoadmapView } from "@/components/roadmap-view";

export const metadata = { title: "My track" };

export default async function LearnPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const { enrollment } = await requireOwnEnrollment(enrollmentId);
  const cohort = (await db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, enrollment.cohortId) }))!;
  const track = (await db.query.tracks.findFirst({ where: eq(schema.tracks.id, cohort.trackId) }))!;
  const tree = await loadTrackTree(track.id);
  const { progress, signoffs } = await loadProgress([enrollment.id]);

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
        progress={new Map(progress.map((p) => [p.itemId, { status: p.status, evidenceUrl: p.evidenceUrl, note: p.note, reviewNote: p.reviewNote }]))}
        enrollmentId={enrollment.id}
      />
    </>
  );
}
