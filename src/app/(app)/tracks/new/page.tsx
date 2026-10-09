import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { LIMITS } from "@/lib/roadmap-core";
import { copyRoadmapAction } from "@/app/actions/roadmap";
import { ImportForm, NewRoadmapForm } from "@/components/roadmap-editor";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";

export const metadata = { title: "New roadmap" };

/** Roadmap Builder: three ways to start a school's own roadmap. Each one makes a draft. */
export default async function NewRoadmapPage() {
  await requireRole(["ADMIN"]);
  const official = await db.select({ id: schema.tracks.id, title: schema.tracks.title, edition: schema.tracks.edition })
    .from(schema.tracks).where(isNull(schema.tracks.ownerOrgId)).orderBy(asc(schema.tracks.title));

  return (
    <>
      <PageHeader title="New roadmap" back={{ href: "/tracks", label: "Tracks" }}
        sub="Your school's own roadmap. It starts as a draft that only your school's admins can see, until you publish it." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="copy-h">
          <h2 id="copy-h" className="h2 mb-1">Copy an official roadmap</h2>
          <p className="mb-3 text-sm text-ink-muted">The quickest start: take a NoorAI roadmap and change what your school needs. The official one stays the same.</p>
          <form action={copyRoadmapAction} className="grid gap-3">
            <div>
              <label className="label" htmlFor="copy-track">Roadmap to copy</label>
              <select id="copy-track" name="trackId" required defaultValue="" className="input">
                <option value="" disabled>Choose a roadmap…</option>
                {official.map((t) => <option key={t.id} value={t.id}>{t.title}{t.edition ? ` (${t.edition.replace(/\s+-\s+/g, " · ")})` : ""}</option>)}
              </select>
            </div>
            <div><button className="btn-primary"><Icon name="copy" size={18} />Copy to my school</button></div>
          </form>
        </section>

        <section className="card p-5" aria-labelledby="blank-h">
          <h2 id="blank-h" className="h2 mb-1">Start from scratch</h2>
          <p className="mb-3 text-sm text-ink-muted">An empty roadmap. You add the stages and lessons next.</p>
          <NewRoadmapForm fields={<>
            <input type="hidden" name="kind" value="COURSE" />
            <div><label className="label" htmlFor="n-title">Title</label><input id="n-title" name="title" required maxLength={LIMITS.title} className="input" placeholder="Computer basics for Class 8" /></div>
            <div><label className="label" htmlFor="n-edition">Edition (optional)</label><input id="n-edition" name="edition" maxLength={LIMITS.title} className="input" placeholder="Edition 1" /></div>
            <div><label className="label" htmlFor="n-summary">Summary (optional)</label><textarea id="n-summary" name="summary" rows={2} maxLength={LIMITS.text} className="input" /></div>
          </>} />
        </section>

        <section className="card p-5 lg:col-span-2" aria-labelledby="upload-h">
          <h2 id="upload-h" className="h2 mb-1">Upload a roadmap file</h2>
          <p className="mb-3 text-sm text-ink-muted">
            A <code>.json</code> file in the same format as NoorAI&apos;s roadmaps. The easiest way to get one: open any roadmap in{" "}
            <Link href="/tracks" className="text-secondary underline">Tracks</Link> and press <b>Download file</b>. The file is checked before anything is saved.
          </p>
          <ImportForm />
        </section>
      </div>
    </>
  );
}
