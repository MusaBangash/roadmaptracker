import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireVisibleTrack } from "@/lib/access";
import { canEditTrack } from "@/lib/access-core";
import { liveDoc } from "@/lib/track-store";

/** Story 6: a roadmap as a file in the content/tracks/*.json format (admins only). `?draft=1`
 *  gives the unpublished draft of the school's own roadmap. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireVisibleTrack(slug);
  if (ctx.role !== "ADMIN" && !ctx.user.isSuperAdmin) notFound();
  const wantDraft = new URL(req.url).searchParams.get("draft") === "1";
  const viewer = { userId: ctx.user.id, orgId: ctx.org?.id ?? null, role: ctx.role };
  const draft = wantDraft && canEditTrack(viewer, ctx.track) ? ctx.track.draft : null;
  if (!draft && ctx.track.status !== "PUBLISHED") notFound();
  const doc = draft ?? await liveDoc(db, ctx.track);
  return new Response(JSON.stringify({ ...doc, slug: ctx.track.slug }, null, 1) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ctx.track.slug}${draft ? "-draft" : ""}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
