import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { loadTrackTree, summarize } from "@/lib/progress";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { RoadmapView } from "@/components/roadmap-view";

export const metadata = { title: "Preview as student" };

/** Staff see a roadmap exactly as a new student would. Nothing ticked here is saved. */
export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireRole(["ADMIN", "INSTRUCTOR"]);
  const track = await db.query.tracks.findFirst({ where: eq(schema.tracks.slug, slug) });
  if (!track) notFound();
  const tree = await loadTrackTree(track.id);

  return (
    <>
      <PageHeader title={track.title} sub={track.edition || track.subtitle} back={{ href: `/tracks/${track.slug}`, label: track.title }} />
      <p role="status" className="mb-6 flex items-start gap-2 rounded-md bg-info-soft px-4 py-3 text-sm text-info">
        <Icon name="info" size={20} />
        <span><b>Preview as student.</b> This is exactly what a new student sees. You can tick lessons to try it, but nothing you tick is saved and the bars stay at the start.</span>
      </p>
      <RoadmapView tree={tree} sum={summarize(tree, [], [])} progress={new Map()} enrollmentId={null} />
    </>
  );
}
