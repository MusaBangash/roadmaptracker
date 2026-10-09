import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/access";
import { toggleOrgTrackAction } from "@/app/actions/admin";
import { PageHeader, Badge } from "@/components/ui";

export const metadata = { title: "Tracks" };

export default async function TracksPage() {
  const ctx = await getContext();
  const all = await db.select({
    t: schema.tracks,
    stages: sql<number>`(select count(*) from "stage" s where s.track_id = "track"."id" and not s.archived)`,
    items: sql<number>`(select count(*) from "item" i join "stage" s on s.id = i.stage_id where s.track_id = "track"."id" and not i.archived)`,
  }).from(schema.tracks).orderBy(asc(schema.tracks.kind), asc(schema.tracks.title));
  const enabled = ctx.org
    ? new Set((await db.select().from(schema.orgTracks).where(eq(schema.orgTracks.orgId, ctx.org.id))).map((r) => r.trackId))
    : new Set<string>();
  const visible = ctx.role === "ADMIN" ? all : all.filter((x) => enabled.has(x.t.id));

  return (
    <>
      <PageHeader title="Tracks" sub={ctx.role === "ADMIN" ? "Turn tracks on or off for your school. Only enabled tracks can be used for cohorts." : "The roadmaps your school uses."} />
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map(({ t, stages, items }) => (
          <div key={t.id} className="card flex flex-col p-5">
            <div className="text-sm font-semibold text-highlight-text">{t.kind === "COURSE" ? "Course" : "Role roadmap"}{t.edition ? ` · ${t.edition.replace(/\s+-\s+/g, " · ")}` : ""}</div>
            <Link href={`/tracks/${t.slug}`} className="mt-1 font-bold text-xl hover:text-primary">{t.title}</Link>
            <p className="mt-1 flex-1 text-sm text-ink-muted">{t.summary || t.subtitle}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
              <span>{Number(stages)} stages · {Number(items)} items</span>
              {ctx.role === "ADMIN" && (
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
        ))}
      </div>
    </>
  );
}
