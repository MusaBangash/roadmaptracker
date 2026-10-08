import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwnEnrollment } from "@/lib/access";
import { PageHeader, Empty } from "@/components/ui";
import { WeeklyLogForm } from "@/components/weekly-log-form";
import { thisMonday, fmtDate } from "@/lib/utils";

export const metadata = { title: "Weekly log" };

export default async function LogPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const { enrollment } = await requireOwnEnrollment(enrollmentId);
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
      <PageHeader title="Weekly log" sub={`${logs.length} weeks logged · ${total} hours in total`} back={{ href: `/learn/${enrollment.id}`, label: "My track" }} />
      <h2 className="h2 mb-3">This week</h2>
      <WeeklyLogForm enrollmentId={enrollment.id} weekStart={monday} initial={current ?? undefined} />
      <h2 className="h2 mb-3 mt-8">Earlier weeks</h2>
      {logs.length === 0 ? <Empty title="No weeks logged yet">Write one line every week — even a week with no progress.</Empty> : (
        <div className="card divide-y divide-line">
          {logs.map((l) => (
            <div key={l.id} className="grid gap-1 p-4 sm:grid-cols-[160px_80px_1fr]">
              <div className="text-sm font-semibold">Week of {fmtDate(l.weekStart)}</div>
              <div className="text-sm text-muted">{l.hours} h</div>
              <div className="text-sm">
                {l.finished || <span className="text-muted">—</span>}
                {l.stuck && <div className="mt-1 text-muted">Stuck: {l.stuck}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
