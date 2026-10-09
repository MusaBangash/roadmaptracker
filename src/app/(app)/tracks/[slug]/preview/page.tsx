import { notFound } from "next/navigation";
import { requireVisibleTrack } from "@/lib/access";
import { canEditTrack } from "@/lib/access-core";
import { loadTrackTree, summarize, type StageNode } from "@/lib/progress";
import type { TrackDoc } from "@/lib/roadmap-core";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { RoadmapView } from "@/components/roadmap-view";

export const metadata = { title: "Preview as student" };

/** A draft shaped like the live roadmap, so the preview is the real student view. */
function treeFromDoc(trackId: string, doc: TrackDoc): StageNode[] {
  return doc.stages.map((s, si) => {
    const stageId = `draft:${s.key}`;
    return {
      id: stageId, trackId, key: s.key, order: si, title: s.title, level: s.level ?? "", weeks: s.weeks ?? 0, benchmark: s.benchmark ?? "",
      goal: s.goal ?? "", doneWhen: s.doneWhen ?? "", resources: s.resources ?? "", optional: !!s.optional, choiceGroup: s.choiceGroup ?? null, archived: false,
      items: s.items.map((it, ii) => ({
        id: `draft:${s.key}/${it.key}`, stageId, key: it.key, order: ii, title: it.title, detail: it.detail ?? "", kind: it.kind ?? "LESSON",
        group: it.group ?? null, optional: !!it.optional, archived: false,
      })),
    };
  });
}

/** Staff see a roadmap exactly as a new student would. Nothing ticked here is saved.
 *  `?draft=1`: the school's own unpublished draft (its admins only). */
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ draft?: string }> }) {
  const [{ slug }, { draft }] = await Promise.all([params, searchParams]);
  const ctx = await requireVisibleTrack(slug);
  if (ctx.role !== "ADMIN" && ctx.role !== "INSTRUCTOR") notFound();
  const { track } = ctx;
  const editable = canEditTrack({ userId: ctx.user.id, orgId: ctx.org?.id ?? null, role: ctx.role }, track);
  const showDraft = draft === "1" && editable && track.draft;
  const tree = showDraft ? treeFromDoc(track.id, track.draft!) : await loadTrackTree(track.id);
  const title = showDraft ? track.draft!.title : track.title;
  const back = editable ? { href: `/tracks/${track.slug}/edit`, label: "Edit roadmap" } : { href: `/tracks/${track.slug}`, label: track.title };

  return (
    <>
      <PageHeader title={title} sub={track.edition || track.subtitle} back={back} />
      <p role="status" className="mb-6 flex items-start gap-2 rounded-md bg-info-soft px-4 py-3 text-sm text-info">
        <Icon name="info" size={20} />
        <span>
          <b>Preview as student{showDraft ? " · unpublished draft" : ""}.</b> {showDraft ? "This is what students will see after you publish. " : "This is exactly what a new student sees. "}
          You can tick lessons to try it, but nothing you tick is saved and the bars stay at the start.
        </span>
      </p>
      {tree.length ? <RoadmapView tree={tree} sum={summarize(tree, [], [])} progress={new Map()} enrollmentId={null} />
        : <p className="text-ink-muted">No stages yet.</p>}
    </>
  );
}
