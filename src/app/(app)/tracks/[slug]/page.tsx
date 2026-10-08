import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/access";
import { loadTrackTree } from "@/lib/progress";
import { PageHeader, LevelPill, KindPill } from "@/components/ui";

export const metadata = { title: "Track" };

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await getContext();
  const track = await db.query.tracks.findFirst({ where: eq(schema.tracks.slug, slug) });
  if (!track) notFound();
  const tree = await loadTrackTree(track.id);
  const weeks = tree.reduce((a, s) => a + (s.choiceGroup ? 0 : s.weeks), 0);
  return (
    <>
      <PageHeader title={track.title} sub={<>{track.subtitle}{weeks ? ` · about ${weeks} weeks` : ""}</>} back={{ href: "/tracks", label: "Tracks" }} />
      {track.expert && <p className="card mb-6 p-4 text-sm"><b className="text-forest">What “expert” means here:</b> {track.expert}</p>}
      {track.benchmarks.length > 0 && (
        <section className="mb-6">
          <h2 className="h2 mb-3">How you know you&apos;re at that level</h2>
          <div className="card divide-y divide-line">
            {track.benchmarks.map((b) => <div key={b.title} className="grid gap-1 p-3 text-sm sm:grid-cols-[200px_1fr]"><b>{b.title}</b><span>{b.detail}</span></div>)}
          </div>
        </section>
      )}
      <div className="space-y-3">
        {tree.map((s, i) => (
          <details key={s.id} className="card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4">
              <span className="font-semibold">{i + 1}. {s.title}</span><LevelPill level={s.level} />
              <span className="ml-auto text-sm text-muted">{s.items.length} items{s.weeks ? ` · ~${s.weeks} wk` : ""}</span>
            </summary>
            <div className="border-t border-line p-4 text-sm">
              {s.benchmark && <p><b className="text-muted">Benchmark:</b> {s.benchmark}</p>}
              {s.doneWhen && <p className="mt-1"><b className="text-saffron-ink">Done when:</b> {s.doneWhen}</p>}
              <ul className="mt-3 space-y-1">
                {s.items.map((it) => <li key={it.id}><span className="font-medium">{it.title}</span> <KindPill kind={it.kind} />{it.detail && <span className="text-muted"> — {it.detail}</span>}</li>)}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
