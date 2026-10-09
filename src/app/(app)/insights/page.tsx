import Link from "next/link";
import { requireRole } from "@/lib/access";
import { insightTables, loadInsights, parseRange, RANGES, weekLabel, type ChartName, type Range } from "@/lib/insights";
import { PageHeader, ProgressBar, Stat, Empty, Badge } from "@/components/ui";
import { ChartTable, ColumnLegend, LineLegend, ProgressLine, ReviewColumns } from "@/components/charts";
import { Icon } from "@/components/icon";
import { fmtDate, pct, plural } from "@/lib/utils";

export const metadata = { title: "Insights" };

function PaceBadge({ pace }: { pace: string | null }) {
  if (!pace) return null;
  if (pace === "Behind the plan") return <Badge tone="warning" icon="offline">{pace}</Badge>;
  if (pace === "Ahead of the plan") return <Badge tone="success" icon="online">{pace}</Badge>;
  return <Badge tone="info" icon="check">{pace}</Badge>;
}

function Section({ id, title, sub, chart, range, children }: { id: string; title: string; sub: string; chart: ChartName; range: Range; children: React.ReactNode }) {
  return (
    <section className="mb-10" aria-labelledby={`${id}-h`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`${id}-h`} className="h2">{title}</h2>
          <p className="text-sm text-ink-muted">{sub}</p>
        </div>
        <a href={`/insights/export?chart=${chart}&range=${range}`} className="btn-ghost text-sm"><Icon name="download" size={16} />Download CSV</a>
      </div>
      {children}
    </section>
  );
}

/** Feature 4: the school's charts. Admins see every open cohort; teachers only theirs. */
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const ctx = await requireRole(["ADMIN", "INSTRUCTOR"]);
  const range = parseRange((await searchParams).range);
  const data = await loadInsights(ctx, range);
  const tables = insightTables(data);
  const scope = ctx.role === "ADMIN" ? "every open cohort" : "the cohorts you teach";

  const ranges = (
    <nav aria-label="Time period" className="flex flex-wrap gap-1 rounded-md border border-border p-1">
      {(Object.keys(RANGES) as Range[]).map((r) => (
        <Link key={r} href={`/insights?range=${r}`} aria-current={r === range ? "page" : undefined}
          className={`rounded px-3 py-1.5 text-sm font-semibold ${r === range ? "bg-primary text-on-primary" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"}`}>{RANGES[r]}</Link>
      ))}
    </nav>
  );

  if (data.cohorts.length === 0) {
    return (
      <>
        <PageHeader title="Insights" sub={`${ctx.org.name} · ${scope}`} />
        <Empty title="No cohorts to show yet">{ctx.role === "ADMIN" ? "Create a cohort and add students; the charts fill in as they work." : "Your school admin will add you to a cohort."}</Empty>
      </>
    );
  }

  const r = data.reviews;
  const totals = r.weeks.reduce((a, w) => ({ submitted: a.submitted + w.submitted, checked: a.checked + w.verified + w.sentBack }), { submitted: 0, checked: 0 });
  const from = weekLabel(data.weeks[0]);

  return (
    <>
      <PageHeader title="Insights" sub={<>{ctx.org.name} · {scope} · {RANGES[range].toLowerCase()} (from the week of {from})</>} actions={ranges} />

      <Section id="progress" title="Progress over time" sub="Each cohort's average progress at the end of every week, against the plan. Counted from the day each item was ticked." chart="progress" range={range}>
        <LineLegend />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.cohorts.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/cohorts/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
                  <div className="text-xs text-ink-muted">{c.track} · started {fmtDate(c.startDate)}</div>
                </div>
                <PaceBadge pace={c.pace} />
              </div>
              <p className="mt-1 text-sm">{c.students ? <>Now <b>{pct(c.avg)}</b> · plan {pct(c.expected)}</> : <span className="text-ink-muted">No active students</span>}</p>
              <div className="mt-2">
                <ProgressLine weeks={data.weeks} avg={c.history.map((h) => h.avg)} plan={c.history.map((h) => h.expected)}
                  label={`${c.name}: class average ${pct(c.avg)} now, the plan expects ${pct(c.expected)}.`} />
              </div>
            </div>
          ))}
        </div>
        <ChartTable caption={tables.progress.title} head={tables.progress.head} rows={tables.progress.rows} />
      </Section>

      <Section id="compare" title="Compare cohorts" sub="Today: average progress (the line marks the plan), students needing attention and attendance. Open a cohort for its students." chart="cohorts" range={range}>
        <div className="grid gap-3 md:grid-cols-2">
          {data.cohorts.map((c) => (
            <Link key={c.id} href={`/cohorts/${c.id}`} className="card block p-4 hover:border-primary">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{c.name}</span>
                <span className="text-sm font-bold">{pct(c.avg)}</span>
              </div>
              <div className="mt-2"><ProgressBar value={c.avg} expected={c.expected} label={`${c.name} average progress`} /></div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span>{plural(c.students, "active student")}</span>
                <span>plan {pct(c.expected)}</span>
                <span className={c.attention ? "font-semibold text-danger" : ""}>{c.attention} need attention</span>
                <span>attendance {c.attendance === null ? "not taken yet" : pct(c.attendance)}</span>
              </div>
            </Link>
          ))}
        </div>
        <ChartTable caption={tables.cohorts.title} head={tables.cohorts.head} rows={tables.cohorts.rows} />
      </Section>

      <Section id="stuck" title="Where students are now" sub="How many active students are on each stage today. A long bar means many students are on that stage: they may be stuck there." chart="stuck" range={range}>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.stuck.map((t) => {
            const top = Math.max(1, ...t.stages.map((s) => s.students));
            const most = Math.max(...t.stages.map((s) => s.students));
            return (
              <div key={t.trackId} className="card p-4">
                <div className="font-semibold">{t.title}</div>
                <div className="mb-3 text-xs text-ink-muted">{plural(t.students, "active student")} · {t.cohorts.join(", ")}</div>
                <ol className="space-y-1.5">
                  {t.stages.map((s, i) => (
                    <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm">
                      <span className="min-w-0 truncate" title={s.title}><span className="text-ink-muted">{i + 1}.</span> {s.title}{s.optional && <span className="text-ink-muted"> (optional)</span>}</span>
                      <span className="text-right text-xs font-semibold tabular-nums">{s.students}</span>
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                          <div className={`h-full rounded-full ${s.students && s.students === most ? "bg-highlight" : "bg-primary"}`} style={{ width: `${(s.students / top) * 100}%` }} />
                        </div>
                        {s.students > 0 && s.students === most && <span className="text-xs font-semibold text-highlight-text">Most students</span>}
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 flex items-center gap-1.5 text-sm"><Icon name="star" size={16} />{plural(t.finished, "student")} finished every required stage.</p>
              </div>
            );
          })}
        </div>
        <ChartTable caption={tables.stuck.title} head={tables.stuck.head} rows={tables.stuck.rows} />
      </Section>

      <Section id="reviews" title="How quickly work is checked" sub="Projects, deliverables and milestones: submitted each week, and verified or sent back." chart="reviews" range={range}>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Average wait" value={r.averageWaitDays === null ? "—" : r.averageWaitDays < 1 ? "Under 1 day" : `${r.averageWaitDays} ${r.averageWaitDays === 1 ? "day" : "days"}`} sub="from submitting to a decision" />
          <Stat label="Waiting now" value={r.waiting} sub="in the review queues" />
          <Stat label="Oldest waiting" value={r.oldestDays === null ? "—" : plural(r.oldestDays, "day")} sub={r.oldestDays !== null && r.oldestDays > 7 ? "over a week: please check" : "since submitted or replied"} />
          <Stat label="In this period" value={`${totals.checked}/${totals.submitted}`} sub="checked / submitted" />
        </div>
        <div className="card max-w-2xl p-4">
          <ColumnLegend />
          <div className="mt-2"><ReviewColumns rows={r.weeks} label={`Work submitted and checked per week: ${totals.submitted} submitted, ${totals.checked} checked.`} /></div>
        </div>
        <ChartTable caption={tables.reviews.title} head={tables.reviews.head} rows={tables.reviews.rows} />
      </Section>
    </>
  );
}
