import Link from "next/link";
import { requireTeachableCohort } from "@/lib/access";
import { PageHeader, Empty } from "@/components/ui";
import { Icon } from "@/components/icon";
import { AttendanceForm } from "@/components/attendance-form";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { CopyButton } from "@/components/copy-button";
import { loadDay, recentAttendance } from "@/lib/attendance";
import { classDaysLabel, dayLabel, isClassDay, missedClassDays, remindFrom } from "@/lib/attendance-core";
import { absentListMessage } from "@/lib/whatsapp";
import { SCHOOL_TZ, schoolToday } from "@/lib/utils";
import { FilterChips } from "@/components/filter-chips";
import { matchesShow, parseShow, RESIDENCE_WORDS, SHOW_WORDS, type Show } from "@/lib/group-core";

export const metadata = { title: "Attendance" };

const timeOf = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: SCHOOL_TZ, hour: "numeric", minute: "2-digit", hour12: true, day: "numeric", month: "short" }).format(d);

export default async function AttendancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string; show?: string }> }) {
  const { id } = await params;
  const { date: qd, show: qs } = await searchParams;
  const { cohort, org } = await requireTeachableCohort(id);
  const show = org.hasHostel ? parseShow(qs) : "all";
  const today = schoolToday();
  const date = qd && /^\d{4}-\d{2}-\d{2}$/.test(qd) && qd <= today ? qd : today;
  const [day, recent] = await Promise.all([loadDay(cohort.id, org.id, date), recentAttendance([cohort.id], today)]);
  const { saved } = day;
  // Hostel students or day scholars only: saving then saves just them.
  const students = day.students.filter((s) => matchesShow(show, s.residence));
  const withShow = (s: Show) => (s === "all" ? "" : `&show=${s}`);
  const days = cohort.classDays;
  const missed = missedClassDays(days, new Set(recent.get(cohort.id)?.keys() ?? []), remindFrom(cohort.startDate.toISOString().slice(0, 10), cohort.classDaysSince), today);
  const href = (d: string) => `/cohorts/${cohort.id}/attendance?date=${d}${withShow(show)}`;

  // The saved day, as a message for a parents' group or the principal.
  const names = (st: string) => students.filter((s) => s.status === st).map((s) => s.name);
  const marked = students.filter((s) => s.status !== null);
  const message = saved && marked.length > 0 && absentListMessage({
    cohort: show === "all" ? cohort.name : `${cohort.name} (${SHOW_WORDS[show]})`, day: dayLabel(date), total: marked.length,
    present: marked.filter((s) => s.status === "PRESENT" || s.status === "LATE").length,
    absent: names("ABSENT"), late: names("LATE"), leave: names("LEAVE"),
  });

  return (
    <>
      <PageHeader title="Attendance" sub={cohort.name} back={{ href: `/cohorts/${cohort.id}`, label: cohort.name }}
        actions={<Link href={`/cohorts/${cohort.id}/attendance/register`} className="btn-ghost"><Icon name="calendar" size={18} />Monthly register</Link>} />

      <div className="mb-4 grid gap-2 text-sm">
        <p>
          {days?.length
            ? <>Class days: <b>{classDaysLabel(days)}</b> · <Link href={`/cohorts/${cohort.id}/edit`} className="text-secondary underline">change</Link></>
            : <>Class days are not set. <Link href={`/cohorts/${cohort.id}/edit`} className="text-secondary underline">Set them</Link> so the dashboard reminds you when attendance isn&apos;t taken.</>}
        </p>
        {days?.length && !isClassDay(days, date) ? <p className="text-ink-muted">{dayLabel(date)} is not one of this class&apos;s days. You can still take attendance for it.</p> : null}
        {missed.length > 0 && (
          <div role="status" className="rounded-md bg-warning-soft px-3 py-2 text-warning">
            <p className="font-semibold">Attendance not taken on {missed.length === 1 ? "this class day" : `these ${missed.length} class days`}:</p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {missed.slice(0, 10).map((d) => <Link key={d} href={href(d)} className="underline">{dayLabel(d)}</Link>)}
            </p>
          </div>
        )}
      </div>

      {org.hasHostel && (
        <FilterChips label="Show" current={show} options={(["all", "hostel", "day"] as const).map((s) => ({ value: s, label: SHOW_WORDS[s], href: `/cohorts/${cohort.id}/attendance?date=${date}${withShow(s)}` }))} />
      )}
      {students.length === 0 ? <Empty title="No students on the list">Accept students waiting to join, or invite students to this cohort first.</Empty> : (
        <>
          {saved && (
            <p className="mb-3 text-sm text-ink-muted">
              Saved for {dayLabel(date)}{saved.by ? <> by <b className="text-ink">{saved.by}</b></> : null}{saved.at ? ` at ${timeOf(saved.at)}` : ""}. You can change it and save again.
            </p>
          )}
          <AttendanceForm key={`${date}-${show}`} cohortId={cohort.id} date={date} today={today}
            students={students.map((s) => ({ ...s, tag: org.hasHostel && s.residence ? RESIDENCE_WORDS[s.residence] : null }))} />
          {message && (
            <section className="card mt-4 p-4">
              <h2 className="font-semibold">Share {dayLabel(date)} on WhatsApp</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-muted" dir="auto">{message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <WhatsAppButton text={message} label="Send on WhatsApp" />
                <CopyButton text={message} label="Copy message" />
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
