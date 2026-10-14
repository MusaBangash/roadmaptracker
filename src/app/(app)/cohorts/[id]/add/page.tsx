import Link from "next/link";
import { requireTeachableCohort } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { AddFromSchool, type AddRow } from "@/components/add-from-school";
import { addableStudents } from "@/lib/add-students";
import { loadGroups } from "@/lib/groups";
import { addNote, inClass } from "@/lib/cohort-core";
import { matchesShow, parseShow, RESIDENCE_WORDS, SHOW_WORDS } from "@/lib/group-core";

export const metadata = { title: "Add students from the school" };

const SHOWN_MAX = 300;

/**
 * Add students who already have an account in the school, without a link: admins pick from every
 * student, teachers from the students of the classes they teach. "From class" ticks everyone active in
 * another class, e.g. to bring last term's class into the next course.
 */
export default async function AddFromSchoolPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; from?: string; group?: string; show?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireTeachableCohort(id);
  const { cohort } = ctx;
  const sp = await searchParams;
  const [{ students, classes }, groups] = await Promise.all([addableStudents(ctx, cohort.id), loadGroups(ctx.org.id)]);

  const from = classes.some((c) => c.id === sp.from) ? sp.from! : null;
  const group = groups.some((g) => g.id === sp.group) ? sp.group! : null;
  const show = ctx.org.hasHostel ? parseShow(sp.show) : "all";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const needle = q.toLowerCase();
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const matching = students.filter((s) =>
    (!from || s.places.some((p) => p.cohortId === from && inClass(p.status) && p.status !== "WITHDRAWN"))
    && (!group || s.places.some((p) => p.groupId === group && inClass(p.status) && p.status !== "WITHDRAWN"))
    && matchesShow(show, s.residence)
    && (!needle || (s.name ?? "").toLowerCase().includes(needle) || (s.email ?? "").toLowerCase().includes(needle)));
  const rows: AddRow[] = matching.slice(0, SHOWN_MAX).map((s) => ({
    userId: s.userId,
    name: s.name ?? s.email ?? "",
    email: s.email,
    // "From class" ticks everyone still active in that class; untick anyone who isn't moving.
    ticked: !!from && s.places.some((p) => p.cohortId === from && p.status === "ACTIVE"),
    tag: ctx.org.hasHostel && s.residence ? RESIDENCE_WORDS[s.residence] : null,
    note: addNote(s.here?.status ?? null, s.here?.leftOn ?? null),
    classes: s.places.filter((p) => inClass(p.status) && p.status !== "WITHDRAWN" && className.has(p.cohortId)).map((p) => className.get(p.cohortId)!),
  }));

  return (
    <>
      <PageHeader title="Add students from the school" sub={cohort.name} back={{ href: `/cohorts/${cohort.id}`, label: cohort.name }} />
      <p className="mb-4 text-sm text-ink-muted">
        Students who already have an account {ctx.role === "ADMIN" ? "in your school" : "in the classes you teach"}. Tick them and press Add:
        they are in this class straight away, with no link and no waiting list. Students already in this class are not listed.
      </p>

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto]">
        <div>
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Name or email" dir="auto" className="input w-full" />
        </div>
        <div>
          <label className="label" htmlFor="from">From class</label>
          <select id="from" name="from" defaultValue={from ?? ""} className="input w-full">
            <option value="">Any class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? " (archived)" : ""}</option>)}
          </select>
        </div>
        {groups.length > 0 && (
          <div>
            <label className="label" htmlFor="group">Group</label>
            <select id="group" name="group" defaultValue={group ?? ""} className="input w-full">
              <option value="">All groups</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
        {ctx.org.hasHostel && (
          <div>
            <label className="label" htmlFor="show">Hostel / Day</label>
            <select id="show" name="show" defaultValue={show} className="input w-full">
              {(["all", "hostel", "day"] as const).map((s) => <option key={s} value={s}>{SHOW_WORDS[s]}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button className="btn-ghost">Show</button>
          {(q || from || group || show !== "all") && <Link href={`/cohorts/${cohort.id}/add`} className="btn-ghost">Clear</Link>}
        </div>
      </form>

      <p className="mb-2 text-sm text-ink-muted">
        {matching.length === students.length ? `${students.length} students can be added.` : `${matching.length} of ${students.length} students match.`}
        {from && " Everyone still active in that class is ticked for you; untick anyone who isn't moving."}
      </p>
      <AddFromSchool key={`${q}|${from}|${group}|${show}`} cohortId={cohort.id} rows={rows} more={matching.length - rows.length} />
    </>
  );
}
