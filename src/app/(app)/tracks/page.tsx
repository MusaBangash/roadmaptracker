import Link from "next/link";
import { asc, eq, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/access";
import { canSeeTrack } from "@/lib/access-core";
import { toggleOrgTrackAction } from "@/app/actions/admin";
import { PageHeader, Badge } from "@/components/ui";
import { Icon } from "@/components/icon";
import { SegmentBar } from "@/components/progress";
import { schoolTrackStats, myTrackProgress } from "@/lib/cohort-stats";
import { pct, plural } from "@/lib/utils";

export const metadata = { title: "Tracks" };

export default async function TracksPage() {
  const ctx = await getContext();
  const all = await db.select({
    t: schema.tracks,
    stages: sql<number>`(select count(*) from "stage" s where s.track_id = "track"."id" and not s.archived)`,
    items: sql<number>`(select count(*) from "item" i join "stage" s on s.id = i.stage_id where s.track_id = "track"."id" and not i.archived)`,
  }).from(schema.tracks)
    // Official roadmaps and this school's own; never another school's. The school's own come first.
    .where(ctx.org ? or(isNull(schema.tracks.ownerOrgId), eq(schema.tracks.ownerOrgId, ctx.org.id)) : isNull(schema.tracks.ownerOrgId))
    .orderBy(sql`"track"."owner_org_id" is null`, asc(schema.tracks.kind), asc(schema.tracks.title));
  const enabled = ctx.org
    ? new Set((await db.select().from(schema.orgTracks).where(eq(schema.orgTracks.orgId, ctx.org.id))).map((r) => r.trackId))
    : new Set<string>();
  const viewer = { userId: ctx.user.id, orgId: ctx.org?.id ?? null, role: ctx.role };
  const visible = (ctx.role === "ADMIN" ? all : all.filter((x) => enabled.has(x.t.id))).filter((x) => canSeeTrack(viewer, x.t));
  const staff = ctx.role === "ADMIN" || ctx.role === "INSTRUCTOR";
  const [stats, mine] = ctx.org
    ? await Promise.all([staff ? schoolTrackStats(ctx.org.id) : null, myTrackProgress(ctx.org.id, ctx.user.id)])
    : [null, new Map<string, { enrollmentId: string; pct: number }>()];

  return (
    <>
      <PageHeader title="Tracks" sub={ctx.role === "ADMIN" ? "Turn tracks on or off for your school. Only enabled tracks can be used for cohorts." : "The roadmaps your school uses."}
        actions={ctx.role === "ADMIN" && <Link href="/tracks/new" className="btn-primary"><Icon name="plus" size={18} />New roadmap</Link>} />
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map(({ t, stages, items }) => {
          const draftOnly = t.status === "DRAFT" && t.draft;
          return (
            <div key={t.id} className="card flex flex-col p-5">
              <div className="text-sm font-semibold text-highlight-text">{t.kind === "COURSE" ? "Course" : "Role roadmap"}{t.edition ? ` · ${t.edition.replace(/\s+-\s+/g, " · ")}` : ""}</div>
              <Link href={`/tracks/${t.slug}`} className="mt-1 font-bold text-xl hover:text-primary">{draftOnly ? t.draft!.title : t.title}</Link>
              {t.ownerOrgId && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone="info" icon="home">Your school&apos;s roadmap</Badge>
                  {t.status === "DRAFT"
                    ? <Badge tone="warning" icon="clock">Draft</Badge>
                    : t.draft && ctx.role === "ADMIN" && <Badge tone="warning" icon="edit">Unpublished changes</Badge>}
                  {ctx.role === "ADMIN" && <Link href={`/tracks/${t.slug}/edit`} className="btn-ghost px-3 text-sm"><Icon name="edit" size={16} />Edit</Link>}
                </div>
              )}
              <p className="mt-1 flex-1 text-sm text-ink-muted">{t.summary || t.subtitle}</p>
              {t.status === "PUBLISHED" && (() => {
                const s = stats?.get(t.id);
                const me = mine.get(t.id);
                return (<>
                  {staff && (
                    <div className="mt-4">
                      {s?.students
                        ? <SegmentBar label="School average" value={s.avg} detail={`${pct(s.avg)} · ${plural(s.cohorts, "cohort")} · ${plural(s.students, "student")}`} />
                        : <p className="text-sm text-ink-muted">{s?.cohorts ? `${plural(s.cohorts, "cohort")}, no active students yet` : "Not used by any cohort yet"}</p>}
                    </div>
                  )}
                  {me && (
                    <Link href={`/learn/${me.enrollmentId}`} className="mt-4 block hover:text-primary">
                      <SegmentBar label="Your progress" value={me.pct} strong />
                    </Link>
                  )}
                </>);
              })()}
              <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
                <span>{draftOnly
                  ? `${plural(t.draft!.stages.length, "stage")} · ${plural(t.draft!.stages.reduce((n, s) => n + s.items.length, 0), "item")} in the draft`
                  : `${Number(stages)} stages · ${Number(items)} items`}</span>
                {ctx.role === "ADMIN" && t.status === "PUBLISHED" && (
                  <form action={toggleOrgTrackAction}>
                    <input type="hidden" name="trackId" value={t.id} /><input type="hidden" name="enabled" value={enabled.has(t.id) ? "0" : "1"} />
                    <span className="flex items-center gap-2">
                      {enabled.has(t.id) ? <Badge tone="success" icon="check">On for your school</Badge> : <Badge tone="neutral" icon="minus">Off</Badge>}
                      <button className={enabled.has(t.id) ? "btn-ghost" : "btn-primary"}>{enabled.has(t.id) ? "Turn off" : "Turn on"}</button>
                    </span>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
