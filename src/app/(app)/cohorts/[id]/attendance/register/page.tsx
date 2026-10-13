import Link from "next/link";
import { requireTeachableCohort } from "@/lib/access";
import { loadRegister, registerMonths } from "@/lib/attendance";
import { monthLabel, monthOf, parseMonth, shiftMonth, weekdayOf } from "@/lib/attendance-core";
import { PageHeader, Empty } from "@/components/ui";
import { PrintButton } from "@/components/certificate-tools";
import { Icon } from "@/components/icon";
import { pct } from "@/lib/utils";
import { FilterChips } from "@/components/filter-chips";
import { parseShow, SHOW_WORDS, type Show } from "@/lib/group-core";

export const metadata = { title: "Attendance register" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Attendance story 2: the monthly register (students × class days), to read, print on A4 or download. */
export default async function RegisterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string; show?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { cohort, org } = await requireTeachableCohort(id);
  const months = await registerMonths(cohort.id);
  const month = parseMonth(sp.month, months[0] ?? monthOf(new Date().toISOString()));
  const show = org.hasHostel ? parseShow(sp.show) : "all";
  const reg = await loadRegister(cohort.id, org.id, month, show);
  const withShow = (s: Show) => (s === "all" ? "" : `&show=${s}`);
  const href = (m: string) => `/cohorts/${cohort.id}/attendance/register?month=${m}${withShow(show)}`;
  const avg = reg.rows.filter((r) => r.pct !== null);
  const classPct = avg.length ? avg.reduce((a, r) => a + r.present, 0) / avg.reduce((a, r) => a + r.counted, 0) : null;
  const cellLook: Record<string, string> = {
    A: "bg-danger-soft text-danger", P: "text-success", L: "bg-warning-soft text-warning", Lv: "text-ink-muted",
  };

  return (
    <>
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <div className="print:hidden">
        <PageHeader title="Attendance register" sub={`${cohort.name} · ${monthLabel(month)}`}
          back={{ href: `/cohorts/${cohort.id}/attendance`, label: "Attendance" }}
          actions={reg.days.length > 0 && <>
            <PrintButton label="Print" />
            <a href={`/cohorts/${cohort.id}/export?type=attendance&month=${month}${withShow(show)}`} className="btn-ghost"><Icon name="download" size={18} />Download for Excel</a>
          </>} />
        <nav className="mb-4 flex flex-wrap items-center gap-2" aria-label="Month">
          <Link href={href(shiftMonth(month, -1))} className="btn-ghost px-3" aria-label="Previous month"><span aria-hidden>←</span></Link>
          <span className="min-w-36 text-center font-semibold">{monthLabel(month)}</span>
          <Link href={href(shiftMonth(month, 1))} className="btn-ghost px-3" aria-label="Next month"><span aria-hidden>→</span></Link>
          {months.length > 1 && (
            <span className="ms-2 flex flex-wrap gap-1 text-xs">
              {months.slice(0, 6).map((m) => (
                <Link key={m} href={href(m)} aria-current={m === month ? "page" : undefined}
                  className={`rounded-full border px-2 py-0.5 ${m === month ? "border-primary bg-primary-soft font-semibold" : "border-border text-ink-muted"}`}>{monthLabel(m)}</Link>
              ))}
            </span>
          )}
        </nav>
        {org.hasHostel && (
          <FilterChips label="Show" current={show} options={(["all", "hostel", "day"] as const).map((s) => ({
            value: s, label: SHOW_WORDS[s], href: `/cohorts/${cohort.id}/attendance/register?month=${month}${withShow(s)}`,
          }))} />
        )}
      </div>

      {/* On paper always black on white, even when the screen is in dark mode. */}
      <div className="print:bg-white print:text-black">
      {/* Printed heading: the page's own header is hidden on paper. */}
      <div className="mb-3 hidden print:block">
        <div className="text-lg font-bold">{org.name}</div>
        <div>Attendance register · {cohort.name} · {monthLabel(month)}{show !== "all" ? ` · ${SHOW_WORDS[show]}` : ""}</div>
      </div>

      {reg.days.length === 0 ? (
        <Empty title={`No attendance in ${monthLabel(month)}`}>Take attendance on the Attendance page; each day you save becomes a column here.</Empty>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-muted print:text-black">
            {reg.days.length} class {reg.days.length === 1 ? "day" : "days"} · {reg.rows.length} students
            {classPct !== null && <> · class attendance <b className="text-ink">{pct(classPct)}</b></>}
            <span className="ms-3">P = present, L = late (counts as present), Lv = leave (doesn&apos;t count), A = absent, blank = not marked</span>
          </p>
          <div className="card overflow-x-auto print:overflow-visible print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
            <table className="w-full border-collapse text-xs print:text-[8pt] print:[&_td]:border-black print:[&_th]:border-black print:[&_tr]:border-black">
              <thead>
                <tr className="bg-surface-sunken print:bg-transparent">
                  <th scope="col" className="sticky start-0 z-10 border-b border-border bg-surface-sunken p-2 text-start print:static print:bg-transparent print:text-black">Student</th>
                  {reg.days.map((d) => (
                    <th key={d} scope="col" className="border-b border-s border-border px-1 py-1 text-center font-semibold">
                      <div>{Number(d.slice(8))}</div><div className="font-normal text-ink-muted print:text-black">{WEEKDAYS[weekdayOf(d)].slice(0, 2)}</div>
                    </th>
                  ))}
                  <th scope="col" className="border-b border-s border-border p-2 text-center">Present</th>
                  <th scope="col" className="border-b border-s border-border p-2 text-center">Absent</th>
                  <th scope="col" className="border-b border-s border-border p-2 text-center">Late</th>
                  <th scope="col" className="border-b border-s border-border p-2 text-center">Leave</th>
                  <th scope="col" className="border-b border-s border-border p-2 text-center">%</th>
                </tr>
              </thead>
              <tbody>
                {reg.rows.map((r) => (
                  <tr key={r.enrollmentId} className="border-b border-border last:border-0">
                    <th scope="row" className="sticky start-0 z-10 max-w-48 truncate bg-surface p-2 text-start font-semibold print:static print:max-w-none print:bg-transparent" dir="auto">{r.name}</th>
                    {r.cells.map((c, i) => (
                      <td key={i} className={`border-s border-border px-1 py-1 text-center font-semibold ${c ? `${cellLook[c]} print:bg-transparent print:text-black` : ""}`}>
                        {c ?? ""}
                      </td>
                    ))}
                    <td className="border-s border-border p-2 text-center">{r.present}/{r.counted}</td>
                    <td className="border-s border-border p-2 text-center">{r.absent}</td>
                    <td className="border-s border-border p-2 text-center">{r.late}</td>
                    <td className="border-s border-border p-2 text-center">{r.leave}</td>
                    <td className="border-s border-border p-2 text-center font-semibold">{r.pct === null ? "—" : pct(r.pct)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border-strong">
                  <th scope="row" className="sticky start-0 z-10 bg-surface p-2 text-start print:static print:bg-transparent">Present that day</th>
                  {reg.presentPerDay.map((n, i) => <td key={i} className="border-s border-border px-1 py-1 text-center">{n}</td>)}
                  <td className="border-s border-border" colSpan={5} />
                </tr>
                <tr>
                  <th scope="row" className="sticky start-0 z-10 bg-surface p-2 text-start print:static print:bg-transparent">Absent that day</th>
                  {reg.perDay.map((d, i) => <td key={i} className="border-s border-border px-1 py-1 text-center">{d.absent}</td>)}
                  <td className="border-s border-border" colSpan={5} />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-10 hidden grid-cols-2 gap-16 text-sm print:grid">
            <div className="border-t border-black pt-1">Teacher&apos;s name and signature</div>
            <div className="border-t border-black pt-1">Checked by (principal / admin)</div>
          </div>
        </>
      )}
      </div>
    </>
  );
}
