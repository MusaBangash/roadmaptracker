import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { PageHeader, Empty, Stat } from "@/components/ui";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { CopyButton } from "@/components/copy-button";
import { hostelDay } from "@/lib/groups";
import { dayLabel } from "@/lib/attendance-core";
import { hostelListMessage } from "@/lib/whatsapp";
import { schoolToday } from "@/lib/utils";

export const metadata = { title: "Hostel" };

/**
 * The hostel list for a day: every hostel student who is absent or on leave, across the classes this
 * person sees (admins: all open classes; teachers: the classes they teach), to send to the warden.
 */
export default async function HostelPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await requireRole(["ADMIN", "INSTRUCTOR"]);
  if (!ctx.org.hasHostel) {
    if (ctx.role !== "ADMIN") notFound();
    return (
      <>
        <PageHeader title="Hostel" sub={ctx.org.name} />
        <Empty title="The hostel is off">Turn on &ldquo;We have a hostel&rdquo; in <Link href="/admin/school" className="underline">School settings</Link> first.</Empty>
      </>
    );
  }
  const today = schoolToday();
  const qd = (await searchParams).date;
  const date = qd && /^\d{4}-\d{2}-\d{2}$/.test(qd) && qd <= today ? qd : today;
  const cohorts = ctx.role === "ADMIN"
    ? await db.select({ id: schema.cohorts.id }).from(schema.cohorts)
        .where(and(eq(schema.cohorts.orgId, ctx.org.id), eq(schema.cohorts.archived, false))).orderBy(asc(schema.cohorts.name))
    : await db.select({ id: schema.cohorts.id }).from(schema.cohortInstructors)
        .innerJoin(schema.cohorts, eq(schema.cohorts.id, schema.cohortInstructors.cohortId))
        .where(and(eq(schema.cohortInstructors.userId, ctx.user.id), eq(schema.cohorts.orgId, ctx.org.id), eq(schema.cohorts.archived, false)));
  const rows = await hostelDay(ctx.org.id, cohorts.map((c) => c.id), date);

  const absent = rows.filter((r) => r.status === "ABSENT");
  const leave = rows.filter((r) => r.status === "LEAVE");
  const present = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  // A class whose hostel students have no mark that day: attendance not taken yet, so the list may grow.
  const byCohort = new Map<string, typeof rows>();
  for (const r of rows) byCohort.set(r.cohortId, [...(byCohort.get(r.cohortId) ?? []), r]);
  const notTaken = [...byCohort.values()].filter((xs) => xs.every((x) => x.status === null)).map((xs) => xs[0].cohort);
  const message = hostelListMessage({
    school: ctx.org.name, day: dayLabel(date), notTaken,
    absent: absent.map((r) => ({ name: r.name, cohort: r.cohort })), leave: leave.map((r) => ({ name: r.name, cohort: r.cohort })),
  });

  const List = ({ title, people }: { title: string; people: typeof rows }) => (
    <section className="mb-6">
      <h2 className="h2 mb-2">{title} ({people.length})</h2>
      {people.length === 0 ? <p className="text-sm text-ink-muted">Nobody.</p> : (
        <ul className="card divide-y divide-border text-sm">
          {people.map((r) => (
            <li key={r.enrollmentId}>
              <Link href={`/cohorts/${r.cohortId}/students/${r.enrollmentId}`} className="flex flex-wrap justify-between gap-2 px-4 py-2 hover:bg-surface-sunken">
                <span className="font-semibold" dir="auto">{r.name}</span><span className="text-ink-muted">{r.cohort}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <PageHeader title="Hostel" sub={`${ctx.org.name} · ${ctx.role === "ADMIN" ? "all classes" : "the classes you teach"}`} />
      <form className="mb-6 flex flex-wrap items-end gap-2">
        <div><label className="label" htmlFor="date">Day</label><input id="date" name="date" type="date" defaultValue={date} max={today} className="input" /></div>
        <button className="btn-ghost">Show</button>
        <span className="self-center text-sm text-ink-muted">{dayLabel(date)}</span>
      </form>

      {rows.length === 0 ? (
        <Empty title="No hostel students yet">Mark students as Hostel on the class page (tick them, then Mark as Hostel) or on a student&apos;s page.</Empty>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Hostel students" value={rows.length} />
            <Stat label="Present" value={present} sub="late counts as present" />
            <Stat label="Absent" value={absent.length} />
            <Stat label="On leave" value={leave.length} />
          </div>
          {notTaken.length > 0 && (
            <p role="status" className="mb-6 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
              Attendance not taken yet in: <b>{notTaken.join(", ")}</b>. This list may grow when it is.
            </p>
          )}
          <List title="Absent" people={absent} />
          <List title="On leave" people={leave} />
          <section className="card p-4">
            <h2 className="font-semibold">Send to the warden</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-muted" dir="auto">{message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <WhatsAppButton text={message} label="Send on WhatsApp" />
              <CopyButton text={message} label="Copy message" />
            </div>
          </section>
        </>
      )}
    </>
  );
}
