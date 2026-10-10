import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwnEnrollment } from "@/lib/access";
import { attendanceSummary, daysOfMonth, monthLabel, monthOf, monthsWithRecords, parseMonth, shiftMonth, weekdayOf } from "@/lib/attendance-core";
import { PageHeader, Empty } from "@/components/ui";
import { Icon } from "@/components/icon";
import { pct } from "@/lib/utils";
import { getT } from "@/i18n/server";

export const metadata = { title: "My attendance" };

/** Attendance story 1: a student's own attendance, overall and as a month calendar. */
export default async function MyAttendancePage({ params, searchParams }: { params: Promise<{ enrollmentId: string }>; searchParams: Promise<{ month?: string }> }) {
  const { enrollmentId } = await params;
  const { enrollment } = await requireOwnEnrollment(enrollmentId);
  const t = await getT();
  const [cohort, records] = await Promise.all([
    db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, enrollment.cohortId) }).then((c) => c!),
    db.select({ date: schema.attendance.date, present: schema.attendance.present }).from(schema.attendance)
      .where(eq(schema.attendance.enrollmentId, enrollment.id)).orderBy(asc(schema.attendance.date)),
  ]);
  const all = attendanceSummary(records);
  // Open on the newest month with class days (or this month before any).
  const month = parseMonth((await searchParams).month, monthsWithRecords(records)[0] ?? monthOf(new Date().toISOString()));
  const byDay = new Map(records.filter((r) => monthOf(r.date) === month).map((r) => [r.date, r.present]));
  const inMonth = attendanceSummary([...byDay.values()].map((present) => ({ present })));
  const days = daysOfMonth(month);
  const lead = weekdayOf(days[0]);
  const absentDays = records.filter((r) => !r.present).map((r) => r.date).reverse();
  const href = (m: string) => `/learn/${enrollment.id}/attendance?month=${m}`;

  return (
    <>
      <PageHeader title={t("att.title")} sub={cohort.name} back={{ href: `/learn/${enrollment.id}`, label: t("log.myTrack") }} />
      {all.total === 0 ? <Empty title={t("att.none")}>{t("att.noneSub")}</Empty> : (
        <>
          <p className="mb-6 text-lg">{t.rich("att.summary", { b: (s) => <b>{s}</b> }, { pct: pct(all.pct!), present: all.present, total: all.total })}</p>

          <section className="card mb-6 max-w-md p-4" aria-labelledby="month-h">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Link href={href(shiftMonth(month, -1))} className="btn-ghost px-3" aria-label={t("att.prev")}><span aria-hidden>←</span></Link>
              <h2 id="month-h" className="font-semibold">{monthLabel(month)}</h2>
              <Link href={href(shiftMonth(month, 1))} className="btn-ghost px-3" aria-label={t("att.next")}><span aria-hidden>→</span></Link>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs" role="table" aria-label={monthLabel(month)}>
              {t("att.weekdays").split(",").map((d) => <div key={d} className="py-1 font-semibold text-ink-muted" role="columnheader">{d}</div>)}
              {Array.from({ length: lead }, (_, i) => <div key={`x${i}`} />)}
              {days.map((d) => {
                const v = byDay.get(d);
                const n = Number(d.slice(8));
                if (v === undefined) return <div key={d} className="rounded-md py-2 text-ink-muted" role="cell">{n}</div>;
                return (
                  <div key={d} role="cell" title={v ? t("att.present") : t("att.absent")}
                    className={`flex flex-col items-center rounded-md py-1 font-semibold ${v ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                    {n}
                    <Icon name={v ? "check" : "x"} size={14} />
                    <span className="sr-only">{v ? t("att.present") : t("att.absent")}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              {inMonth.total ? t("att.monthSummary", { month: monthLabel(month), present: inMonth.present, total: inMonth.total }) : t("att.monthNone", { month: monthLabel(month) })}
            </p>
            <p className="mt-2 flex gap-4 text-xs text-ink-muted">
              <span className="flex items-center gap-1"><span className="text-success"><Icon name="check" size={14} /></span>{t("att.present")}</span>
              <span className="flex items-center gap-1"><span className="text-danger"><Icon name="x" size={14} /></span>{t("att.absent")}</span>
            </p>
          </section>

          {absentDays.length > 0 && (
            <section className="max-w-md">
              <h2 className="h2 mb-2">{t("att.absentDays")} ({absentDays.length})</h2>
              <ul className="card divide-y divide-border text-sm">
                {absentDays.slice(0, 30).map((d) => (
                  <li key={d}><Link href={href(monthOf(d))} className="block px-4 py-2 hover:bg-surface-sunken">{t.date(d)}</Link></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
