import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwnEnrollment } from "@/lib/access";
import { loadTrackTree, loadProgress, summarize, expectedPct, expectedStagePcts } from "@/lib/progress";
import { PageHeader } from "@/components/ui";
import { RoadmapView } from "@/components/roadmap-view";
import { loadCoverage } from "@/lib/coverage";
import { fmtDate } from "@/lib/utils";
import { validCertificate } from "@/lib/certificates";
import { Icon } from "@/components/icon";
import { byThread, loadComments, toViews, unreadFor } from "@/lib/comments";

export const metadata = { title: "My track" };

export default async function LearnPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const { enrollment, user } = await requireOwnEnrollment(enrollmentId);
  const cohort = (await db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, enrollment.cohortId) }))!;
  const [track, tree, { progress, signoffs }, taught, cert, comments] = await Promise.all([
    db.query.tracks.findFirst({ where: eq(schema.tracks.id, cohort.trackId) }).then((t) => t!),
    loadTrackTree(cohort.trackId),
    loadProgress([enrollment.id]),
    loadCoverage(cohort.id),
    validCertificate(enrollment.id),
    loadComments([enrollment.id]),
  ]);
  // Comments (feature 3): each item's thread, and what the teachers wrote since the student last looked.
  const seen = new Map(progress.map((p) => [p.itemId, p.studentSeenAt]));
  const threads = new Map([...byThread(comments)].map(([key, rows]) => {
    const itemId = key.split(":")[1];
    return [itemId, { comments: toViews(rows, { id: user.id, admin: false }), unread: unreadFor(rows, "STUDENT", seen.get(itemId) ?? null) }];
  }));
  const titles = new Map(tree.flatMap((s, i) => s.items.map((it) => [it.id, `${it.title} (Stage ${i + 1})`] as const)));
  const fresh = [...threads].filter(([, t]) => t.unread > 0).map(([itemId]) => itemId).filter((id) => titles.has(id));

  return (
    <>
      <PageHeader
        title={track.title}
        sub={<>{cohort.name}{track.edition ? ` · ${track.edition}` : ""}</>}
        back={{ href: "/dashboard", label: "Dashboard" }}
        actions={<>
          {cert && <Link href={`/certificates/${cert.code}`} className="btn-primary"><Icon name="star" size={18} />Download certificate</Link>}
          <Link href={`/learn/${enrollment.id}/log`} className="btn-ghost">Weekly log</Link>
        </>}
      />
      {cert && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-md bg-success-soft px-4 py-3 text-sm text-success">
          <Icon name="star" size={20} />
          <span><b>Congratulations! You completed this roadmap</b> on {fmtDate(cert.completedOn)}. <Link href={`/certificates/${cert.code}`} className="font-semibold underline">Open your certificate</Link> to download it or share its check link.</span>
        </p>
      )}
      {fresh.length > 0 && (
        <div role="status" className="mb-6 rounded-md bg-info-soft px-4 py-3 text-sm text-info">
          <p className="flex items-center gap-2 font-semibold"><Icon name="comment" size={20} />New comment from your teacher</p>
          <ul className="mt-1 list-disc pl-9">
            {fresh.map((id) => <li key={id}><a href={`#item-${id}`} className="underline">{titles.get(id)}</a></li>)}
          </ul>
        </div>
      )}
      <RoadmapView
        tree={tree}
        sum={summarize(tree, progress, signoffs)}
        expected={expectedPct(tree, cohort.startDate)}
        expectedStages={expectedStagePcts(tree, cohort.startDate)}
        progress={new Map(progress.map((p) => [p.itemId, { status: p.status, evidenceUrl: p.evidenceUrl, note: p.note, reviewNote: p.reviewNote, byTeacher: !!p.markedById }]))}
        taught={new Map([...taught].map(([itemId, t]) => [itemId, fmtDate(t.taughtOn)]))}
        enrollmentId={enrollment.id}
        threads={threads}
      />
    </>
  );
}
