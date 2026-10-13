import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwnEnrollment } from "@/lib/access";
import { loadTrackTree, loadProgress, summarize, expectedPct, expectedStagePcts } from "@/lib/progress";
import { PageHeader, Badge } from "@/components/ui";
import { RoadmapView } from "@/components/roadmap-view";
import { loadCoverage } from "@/lib/coverage";
import { validCertificate } from "@/lib/certificates";
import { Icon } from "@/components/icon";
import { byThread, loadComments, toViews, unreadFor } from "@/lib/comments";
import { getT } from "@/i18n/server";
import { attendanceSummary } from "@/lib/attendance-core";
import { pct } from "@/lib/utils";
import { inClass } from "@/lib/cohort-core";

export const metadata = { title: "My track" };

export default async function LearnPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const { enrollment, user } = await requireOwnEnrollment(enrollmentId);
  const t = await getT();
  const cohort = (await db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, enrollment.cohortId) }))!;
  if (!inClass(enrollment.status)) {
    // Waiting for a teacher to accept them, or turned away: nothing to tick yet.
    const track = (await db.query.tracks.findFirst({ where: eq(schema.tracks.id, cohort.trackId) }))!;
    const waiting = enrollment.status === "PENDING";
    return (
      <>
        <PageHeader title={track.title} sub={cohort.name} back={{ href: "/dashboard", label: t("nav.dashboard") }} />
        <div role="status" className="card max-w-xl p-5">
          <Badge tone={waiting ? "info" : "neutral"} icon={waiting ? "clock" : "minus"} wrap>{t(waiting ? "dash.waiting" : "dash.turnedAway")}</Badge>
          <p className="mt-3 text-sm">{t(waiting ? "dash.waitingSub" : "dash.turnedAwaySub")}</p>
        </div>
      </>
    );
  }
  const [track, tree, { progress, signoffs }, taught, cert, comments, attendance] = await Promise.all([
    db.query.tracks.findFirst({ where: eq(schema.tracks.id, cohort.trackId) }).then((t) => t!),
    loadTrackTree(cohort.trackId),
    loadProgress([enrollment.id]),
    loadCoverage(cohort.id),
    validCertificate(enrollment.id),
    loadComments([enrollment.id]),
    db.select({ present: schema.attendance.present }).from(schema.attendance).where(eq(schema.attendance.enrollmentId, enrollment.id)),
  ]);
  const att = attendanceSummary(attendance);
  // Comments (feature 3): each item's thread, and what the teachers wrote since the student last looked.
  const seen = new Map(progress.map((p) => [p.itemId, p.studentSeenAt]));
  const threads = new Map([...byThread(comments)].map(([key, rows]) => {
    const itemId = key.split(":")[1];
    return [itemId, { comments: toViews(rows, { id: user.id, admin: false }, t), unread: unreadFor(rows, "STUDENT", seen.get(itemId) ?? null) }];
  }));
  const titles = new Map(tree.flatMap((s, i) => s.items.map((it) => [it.id, t("learn.itemStage", { title: it.title, n: i + 1 })] as const)));
  const fresh = [...threads].filter(([, t]) => t.unread > 0).map(([itemId]) => itemId).filter((id) => titles.has(id));

  return (
    <>
      <PageHeader
        title={track.title}
        sub={<>{cohort.name}{track.edition ? ` · ${track.edition}` : ""}</>}
        back={{ href: "/dashboard", label: t("nav.dashboard") }}
        actions={<>
          {cert && <Link href={`/certificates/${cert.code}`} className="btn-primary"><Icon name="star" size={18} />{t("learn.downloadCert")}</Link>}
          <Link href={`/learn/${enrollment.id}/log`} className="btn-ghost">{t("learn.weeklyLog")}</Link>
          <Link href={`/learn/${enrollment.id}/attendance`} className="btn-ghost"><Icon name="calendar" size={18} />{t("learn.attendance")}</Link>
        </>}
      />
      {att.pct !== null && (
        <p className="mb-6 text-sm">
          <Link href={`/learn/${enrollment.id}/attendance`} className="inline-flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2 hover:underline">
            <Icon name="calendar" size={18} />
            <span>{t.rich("learn.attendanceLine", { b: (s) => <b>{s}</b> }, { pct: pct(att.pct), present: att.present, total: att.total })}</span>
          </Link>
        </p>
      )}
      {cert && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-md bg-success-soft px-4 py-3 text-sm text-success">
          <Icon name="star" size={20} />
          <span>{t.rich("learn.congrats", { b: (s) => <b>{s}</b>, link: (s) => <Link href={`/certificates/${cert.code}`} className="font-semibold underline">{s}</Link> }, { date: t.date(cert.completedOn) })}</span>
        </p>
      )}
      {fresh.length > 0 && (
        <div role="status" className="mb-6 rounded-md bg-info-soft px-4 py-3 text-sm text-info">
          <p className="flex items-center gap-2 font-semibold"><Icon name="comment" size={20} />{t("learn.newComment")}</p>
          <ul className="mt-1 list-disc ps-9">
            {fresh.map((id) => <li key={id}><a href={`#item-${id}`} className="underline" dir="auto">{titles.get(id)}</a></li>)}
          </ul>
        </div>
      )}
      <RoadmapView
        tree={tree}
        sum={summarize(tree, progress, signoffs)}
        expected={expectedPct(tree, cohort.startDate)}
        expectedStages={expectedStagePcts(tree, cohort.startDate)}
        progress={new Map(progress.map((p) => [p.itemId, { status: p.status, evidenceUrl: p.evidenceUrl, note: p.note, reviewNote: p.reviewNote, byTeacher: !!p.markedById }]))}
        taught={new Map([...taught].map(([itemId, c]) => [itemId, t.date(c.taughtOn)]))}
        enrollmentId={enrollment.id}
        threads={threads}
      />
    </>
  );
}
