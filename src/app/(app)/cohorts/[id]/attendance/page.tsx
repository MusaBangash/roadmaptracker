import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireTeachableCohort } from "@/lib/access";
import Link from "next/link";
import { PageHeader, Empty } from "@/components/ui";
import { Icon } from "@/components/icon";
import { AttendanceForm } from "@/components/attendance-form";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const { id } = await params;
  const { date: qd } = await searchParams;
  const { cohort } = await requireTeachableCohort(id);
  const date = qd && /^\d{4}-\d{2}-\d{2}$/.test(qd) ? qd : new Date().toISOString().slice(0, 10);
  const rows = await db.select({ e: schema.enrollments, name: schema.users.name, email: schema.users.email })
    .from(schema.enrollments).innerJoin(schema.users, eq(schema.enrollments.userId, schema.users.id))
    .where(and(eq(schema.enrollments.cohortId, cohort.id), inArray(schema.enrollments.status, ["ACTIVE", "PAUSED"])))
    .orderBy(schema.users.name);
  const recs = rows.length
    ? await db.select().from(schema.attendance).where(and(inArray(schema.attendance.enrollmentId, rows.map((r) => r.e.id)), eq(schema.attendance.date, date)))
    : [];
  const byE = new Map(recs.map((r) => [r.enrollmentId, r.present]));
  return (
    <>
      <PageHeader title="Attendance" sub={cohort.name} back={{ href: `/cohorts/${cohort.id}`, label: cohort.name }}
        actions={<Link href={`/cohorts/${cohort.id}/attendance/register`} className="btn-ghost"><Icon name="calendar" size={18} />Monthly register</Link>} />
      {rows.length === 0 ? <Empty title="No active students">Invite students to this cohort first.</Empty> : (
        <AttendanceForm key={date} cohortId={cohort.id} date={date}
          students={rows.map((r) => ({ enrollmentId: r.e.id, name: r.name ?? r.email ?? "Student", present: byE.has(r.e.id) ? byE.get(r.e.id)! : null }))} />
      )}
    </>
  );
}
