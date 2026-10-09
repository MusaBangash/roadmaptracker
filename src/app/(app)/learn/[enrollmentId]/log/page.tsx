import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwnEnrollment } from "@/lib/access";
import { PageHeader, Empty } from "@/components/ui";
import { WeeklyLogForm } from "@/components/weekly-log-form";
import { thisMonday } from "@/lib/utils";
import { getT } from "@/i18n/server";

export const metadata = { title: "Weekly log" };

export default async function LogPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const { enrollment } = await requireOwnEnrollment(enrollmentId);
  const t = await getT();
  const monday = thisMonday();
  const logs = await db.query.weeklyLogs.findMany({
    where: eq(schema.weeklyLogs.enrollmentId, enrollment.id),
    orderBy: desc(schema.weeklyLogs.weekStart),
  });
  const current = await db.query.weeklyLogs.findFirst({
    where: and(eq(schema.weeklyLogs.enrollmentId, enrollment.id), eq(schema.weeklyLogs.weekStart, monday)),
  });
  const total = logs.reduce((a, l) => a + l.hours, 0);

  return (
    <>
      <PageHeader title={t("log.title")} sub={t("log.sub", { weeks: t.plural("log.weeksLogged", logs.length), hours: total })} back={{ href: `/learn/${enrollment.id}`, label: t("log.myTrack") }} />
      <h2 className="h2 mb-3">{t("log.thisWeek")}</h2>
      <WeeklyLogForm enrollmentId={enrollment.id} weekStart={monday} initial={current ?? undefined} />
      <h2 className="h2 mb-3 mt-8">{t("log.earlier")}</h2>
      {logs.length === 0 ? <Empty title={t("log.empty")}>{t("log.emptySub")}</Empty> : (
        <div className="card divide-y divide-border">
          {logs.map((l) => (
            <div key={l.id} className="grid gap-1 p-4 sm:grid-cols-[160px_80px_1fr]">
              <div className="text-sm font-semibold">{t("log.weekOf", { date: t.date(l.weekStart) })}</div>
              <div className="text-sm text-ink-muted">{t("common.hours", { n: l.hours })}</div>
              <div className="text-sm" dir="auto">
                {l.finished || <span className="text-ink-muted">—</span>}
                {l.stuck && <div className="mt-1 text-ink-muted">{t("log.stuck", { text: l.stuck })}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
