import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireEditableTrack } from "@/lib/access";
import { diffDocs, hasChanges, ITEM_KINDS, LIMITS, publishProblems, type ItemDoc, type StageDoc, type TrackDoc } from "@/lib/roadmap-core";
import { liveDoc, workOnRemoved } from "@/lib/track-store";
import { discardRoadmapAction } from "@/app/actions/roadmap";
import { ConfirmButton, EditForm, ImportForm, PublishForm, SaveButton, StepButton } from "@/components/roadmap-editor";
import { Badge, KindPill, PageHeader, Tag } from "@/components/ui";
import { Icon } from "@/components/icon";
import { plural } from "@/lib/utils";

export const metadata = { title: "Edit roadmap" };

const KIND_LABEL: Record<(typeof ITEM_KINDS)[number], string> = { LESSON: "Lesson", PROJECT: "Project", DELIVERABLE: "Deliverable", MILESTONE: "Milestone" };

/** Roadmap Builder (Step 3): edit a school's own roadmap. Changes wait in a draft until Publish. */
export default async function EditRoadmapPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ uploaded?: string; published?: string }>;
}) {
  const [{ slug }, { uploaded, published }] = await Promise.all([params, searchParams]);
  const found = await db.query.tracks.findFirst({ where: eq(schema.tracks.slug, slug), columns: { id: true } });
  if (!found) notFound();
  const { track } = await requireEditableTrack(found.id);
  const live = track.status === "PUBLISHED" ? await liveDoc(db, track) : null;
  const doc: TrackDoc = track.draft ?? live!;
  const diff = track.draft ? diffDocs(live, track.draft) : null;
  const changed = !live || (diff !== null && hasChanges(diff));
  const hidden = live && track.draft ? await workOnRemoved(track.id, live, track.draft) : 0;
  const problems = publishProblems(doc);
  const id = track.id;

  return (
    <>
      <PageHeader title={doc.title} back={{ href: live ? `/tracks/${track.slug}` : "/tracks", label: live ? track.title : "Tracks" }}
        sub={live ? (changed ? <Badge tone="info" icon="edit">Published · unpublished changes</Badge> : <Badge tone="success" icon="check">Published · up to date</Badge>)
          : <Badge tone="warning" icon="clock">Draft · not published yet</Badge>}
        actions={<>
          <Link href={`/tracks/${track.slug}/preview${track.draft ? "?draft=1" : ""}`} className="btn-ghost"><Icon name="computer" size={18} />Preview as student</Link>
          <a href={`/tracks/${track.slug}/download${track.draft ? "?draft=1" : ""}`} className="btn-ghost"><Icon name="download" size={18} />Download file</a>
        </>} />

      {published && !track.draft && <p role="status" className="mb-4 flex items-center gap-2 rounded-md bg-success-soft px-4 py-3 text-sm text-success"><Icon name="check" size={18} />Published. Teachers and students now see this version.</p>}
      {uploaded && <p role="status" className="mb-4 flex items-center gap-2 rounded-md bg-success-soft px-4 py-3 text-sm text-success"><Icon name="check" size={18} />File checked and saved as the draft. Look it over, then publish.</p>}

      <section className="card mb-6 grid gap-3 p-4 sm:p-5" aria-labelledby="publish-h">
        <h2 id="publish-h" className="h2">{live ? "Publish your changes" : "Publish this roadmap"}</h2>
        {!live && <p className="text-sm text-ink-muted">Only your school&apos;s admins can see this draft. Once published, you can create cohorts on it, and teachers and students can open it.</p>}
        {live && diff && changed && (
          <div className="text-sm">
            <p className="font-semibold">What publishing will change:</p>
            <ul className="mt-1 list-disc pl-5">
              {diff.details && <li>The roadmap&apos;s title or description</li>}
              {diff.stages.added.length > 0 && <li>{plural(diff.stages.added.length, "stage")} added: {diff.stages.added.join(", ")}</li>}
              {diff.stages.removed.length > 0 && <li>{plural(diff.stages.removed.length, "stage")} removed: {diff.stages.removed.join(", ")}</li>}
              {diff.stages.changed.length > 0 && <li>{plural(diff.stages.changed.length, "stage")} edited: {diff.stages.changed.join(", ")}</li>}
              {diff.items.added.length > 0 && <li>{plural(diff.items.added.length, "item")} added</li>}
              {diff.items.removed.length > 0 && <li>{plural(diff.items.removed.length, "item")} removed</li>}
              {diff.items.changed.length > 0 && <li>{plural(diff.items.changed.length, "item")} edited</li>}
              {diff.reordered && <li>The order of stages or items</li>}
            </ul>
            {hidden > 0 && (
              <p className="mt-2 flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-warning">
                <Icon name="info" size={18} />
                <span>Students have {plural(hidden, "tick or submission", "ticks or submissions")} on the removed items. They are hidden, not deleted: if you later put back an item with the same key (for example by uploading a file), its work returns.</span>
              </p>
            )}
          </div>
        )}
        {live && !changed && <p className="text-sm text-ink-muted">Students see exactly this roadmap. Any change you make below is saved as a draft first.</p>}
        {problems.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-warning">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        )}
        {changed && (
          <div className="flex flex-wrap items-start gap-3">
            <PublishForm trackId={id} label={live ? "Publish changes" : "Publish roadmap"} disabled={problems.length > 0} />
            <form action={discardRoadmapAction}>
              <input type="hidden" name="trackId" value={id} />
              <ConfirmButton className="btn-ghost text-danger"
                message={live ? "Throw away every unpublished change? Students keep seeing the published roadmap." : "Delete this draft roadmap? This can't be undone."}>
                <Icon name="trash" size={18} />{live ? "Discard changes" : "Delete draft"}
              </ConfirmButton>
            </form>
          </div>
        )}
        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold">Replace the draft with a roadmap file</summary>
          <p className="my-2 text-sm text-ink-muted">Items keep their students&apos; work when their key stays the same. Download the file first to edit it.</p>
          <ImportForm trackId={id} />
        </details>
      </section>

      <section className="card mb-6 p-4 sm:p-5" aria-labelledby="details-h">
        <h2 id="details-h" className="h2 mb-3">Details</h2>
        <EditForm op="details" trackId={id}>
          <DetailsFields doc={doc} />
          <div><SaveButton /></div>
        </EditForm>
      </section>

      <h2 className="h2 mb-1">Stages</h2>
      <p className="mb-3 text-sm text-ink-muted">{plural(doc.stages.length, "stage")} · {plural(doc.stages.reduce((n, s) => n + s.items.length, 0), "item")}. Open a stage to edit it and its lessons and projects.</p>
      <div className="mb-6 space-y-3">
        {doc.stages.map((s, si) => (
          <details key={s.key} className="card" open={doc.stages.length === 1 || undefined}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4">
              <span className="font-semibold">{si + 1}. {s.title}</span>
              {s.optional && <Tag>Optional</Tag>}
              <span className="ml-auto text-sm text-ink-muted">{plural(s.items.length, "item")}{s.weeks ? ` · ${plural(s.weeks, "week")}` : ""}</span>
            </summary>
            <div className="grid gap-4 border-t border-border p-4">
              <div className="flex flex-wrap gap-2">
                {si > 0 && <StepButton op="moveStage" dir="up" trackId={id} stageKey={s.key} icon="up" label="Move up" />}
                {si < doc.stages.length - 1 && <StepButton op="moveStage" dir="down" trackId={id} stageKey={s.key} icon="down" label="Move down" />}
                <StepButton op="removeStage" trackId={id} stageKey={s.key} icon="trash" label="Remove stage"
                  confirm={`Remove stage “${s.title}” and its ${plural(s.items.length, "item")}? Students' work on it is kept but hidden once you publish.`} />
              </div>
              <EditForm op="updateStage" trackId={id} stageKey={s.key} className="grid gap-3 sm:grid-cols-2">
                <StageFields stage={s} idp={s.key} />
                <div className="sm:col-span-2"><SaveButton label="Save stage" /></div>
              </EditForm>
              <div>
                <h3 className="mb-2 font-semibold">Lessons and projects</h3>
                {s.items.length === 0 && <p className="text-sm text-ink-muted">None yet. Add the first one below.</p>}
                <ol className="divide-y divide-border rounded-md border border-border">
                  {s.items.map((it, ii) => (
                    <li key={it.key}>
                      <details>
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2 text-sm">
                          <span className="font-medium">{it.title}</span><KindPill kind={it.kind ?? "LESSON"} />
                          {it.group && <Tag>{it.group}</Tag>}{it.optional && <Tag>Optional</Tag>}
                          <span className="ml-auto inline-flex items-center gap-1 text-ink-muted"><Icon name="edit" size={14} />Edit</span>
                        </summary>
                        <div className="grid gap-3 border-t border-border bg-surface-sunken p-3">
                          <div className="flex flex-wrap gap-2">
                            {ii > 0 && <StepButton op="moveItem" dir="up" trackId={id} stageKey={s.key} itemKey={it.key} icon="up" label="Move up" />}
                            {ii < s.items.length - 1 && <StepButton op="moveItem" dir="down" trackId={id} stageKey={s.key} itemKey={it.key} icon="down" label="Move down" />}
                            <StepButton op="removeItem" trackId={id} stageKey={s.key} itemKey={it.key} icon="trash" label="Remove"
                              confirm={`Remove “${it.title}”? Students' work on it is kept but hidden once you publish.`} />
                          </div>
                          <EditForm op="updateItem" trackId={id} stageKey={s.key} itemKey={it.key} className="grid gap-3 sm:grid-cols-2">
                            <ItemFields item={it} idp={`${s.key}-${it.key}`} />
                            <div className="sm:col-span-2"><SaveButton label="Save item" /></div>
                          </EditForm>
                        </div>
                      </details>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-md border border-dashed border-border-strong p-3">
                <h3 className="mb-2 font-semibold">Add a lesson or project to this stage</h3>
                <EditForm op="addItem" trackId={id} stageKey={s.key} className="grid gap-3 sm:grid-cols-2">
                  <ItemFields idp={`${s.key}-new`} />
                  <div className="sm:col-span-2"><SaveButton label="Add item" busy="Adding…" icon="plus" /></div>
                </EditForm>
              </div>
            </div>
          </details>
        ))}
      </div>

      <section className="card p-4 sm:p-5" aria-labelledby="add-stage-h">
        <h2 id="add-stage-h" className="h2 mb-3">Add a stage</h2>
        <EditForm op="addStage" trackId={id} className="grid gap-3 sm:grid-cols-2">
          <StageFields idp="new-stage" />
          <div className="sm:col-span-2"><SaveButton label="Add stage" busy="Adding…" icon="plus" /></div>
        </EditForm>
      </section>
    </>
  );
}

function DetailsFields({ doc }: { doc: TrackDoc }) {
  return (<>
    <div><label className="label" htmlFor="d-title">Title</label><input id="d-title" name="title" required maxLength={LIMITS.title} defaultValue={doc.title} className="input" /></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="d-kind">Type</label>
        <select id="d-kind" name="kind" defaultValue={doc.kind ?? "COURSE"} className="input">
          <option value="COURSE">Course</option><option value="ROLE">Role roadmap</option>
        </select>
      </div>
      <div><label className="label" htmlFor="d-edition">Edition</label><input id="d-edition" name="edition" maxLength={LIMITS.title} defaultValue={doc.edition ?? ""} className="input" placeholder="Edition 1" /></div>
    </div>
    <div><label className="label" htmlFor="d-subtitle">Subtitle</label><input id="d-subtitle" name="subtitle" maxLength={LIMITS.title} defaultValue={doc.subtitle ?? ""} className="input" placeholder="12 weeks · 48 sessions" /></div>
    <div><label className="label" htmlFor="d-summary">Summary</label><textarea id="d-summary" name="summary" rows={2} maxLength={LIMITS.text} defaultValue={doc.summary ?? ""} className="input" /></div>
  </>);
}

function StageFields({ stage, idp }: { stage?: StageDoc; idp: string }) {
  return (<>
    <div className="sm:col-span-2"><label className="label" htmlFor={`${idp}-title`}>Stage title</label><input id={`${idp}-title`} name="title" required maxLength={LIMITS.title} defaultValue={stage?.title} className="input" placeholder="Month 1 — Foundations" /></div>
    <div><label className="label" htmlFor={`${idp}-weeks`}>Weeks</label><input id={`${idp}-weeks`} name="weeks" type="number" inputMode="numeric" min={0} max={LIMITS.weeks} defaultValue={stage?.weeks ?? ""} className="input" /></div>
    <div><label className="label" htmlFor={`${idp}-level`}>Level label</label><input id={`${idp}-level`} name="level" maxLength={80} defaultValue={stage?.level ?? ""} className="input" placeholder="Beginner" /></div>
    <div className="sm:col-span-2"><label className="label" htmlFor={`${idp}-goal`}>Goal</label><textarea id={`${idp}-goal`} name="goal" rows={2} maxLength={LIMITS.text} defaultValue={stage?.goal ?? ""} className="input" /></div>
    <div className="sm:col-span-2"><label className="label" htmlFor={`${idp}-done`}>Done when</label><textarea id={`${idp}-done`} name="doneWhen" rows={2} maxLength={LIMITS.text} defaultValue={stage?.doneWhen ?? ""} className="input" /></div>
    <label className="flex min-h-[var(--control-height)] items-center gap-2 text-sm sm:col-span-2">
      <input type="checkbox" name="optional" defaultChecked={!!stage?.optional} className="h-5 w-5 accent-primary" />
      Optional stage (counts towards progress only once a student starts it)
    </label>
  </>);
}

function ItemFields({ item, idp }: { item?: ItemDoc; idp: string }) {
  return (<>
    <div className="sm:col-span-2"><label className="label" htmlFor={`${idp}-title`}>Title</label><input id={`${idp}-title`} name="title" required maxLength={LIMITS.title} defaultValue={item?.title} className="input" /></div>
    <div>
      <label className="label" htmlFor={`${idp}-kind`}>Kind</label>
      <select id={`${idp}-kind`} name="kind" defaultValue={item?.kind ?? "LESSON"} className="input">
        {ITEM_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
      </select>
    </div>
    <div><label className="label" htmlFor={`${idp}-group`}>Week label</label><input id={`${idp}-group`} name="group" maxLength={80} defaultValue={item?.group ?? ""} className="input" placeholder="Week 1" /></div>
    <div className="sm:col-span-2"><label className="label" htmlFor={`${idp}-detail`}>Detail</label><textarea id={`${idp}-detail`} name="detail" rows={2} maxLength={LIMITS.text} defaultValue={item?.detail ?? ""} className="input" /></div>
    <label className="flex min-h-[var(--control-height)] items-center gap-2 text-sm sm:col-span-2">
      <input type="checkbox" name="optional" defaultChecked={!!item?.optional} className="h-5 w-5 accent-primary" />
      Optional (not counted in progress)
    </label>
  </>);
}
