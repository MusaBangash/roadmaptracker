import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireTeachableCohort } from "@/lib/access";
import { canChangeTrack } from "@/lib/cohort-core";
import { PageHeader } from "@/components/ui";
import { EditCohortForm } from "@/components/cohort-form";
import { loadGroups } from "@/lib/groups";

export const metadata = { title: "Edit cohort" };

export default async function EditCohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cohort, org } = await requireTeachableCohort(id);
  const [tracks, [{ n }]] = await Promise.all([
    db.select({ id: schema.tracks.id, title: schema.tracks.title, edition: schema.tracks.edition })
      .from(schema.orgTracks).innerJoin(schema.tracks, eq(schema.orgTracks.trackId, schema.tracks.id))
      .where(eq(schema.orgTracks.orgId, org.id)).orderBy(schema.tracks.title),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.enrollments).where(eq(schema.enrollments.cohortId, cohort.id)),
  ]);
  return (
    <>
      <PageHeader title="Edit cohort" sub={cohort.name} back={{ href: `/cohorts/${cohort.id}`, label: cohort.name }} />
      <EditCohortForm tracks={tracks} trackLocked={!canChangeTrack(n)} groups={await loadGroups(org.id)}
        cohort={{ id: cohort.id, name: cohort.name, startDate: cohort.startDate.toISOString().slice(0, 10), trackId: cohort.trackId, classDays: cohort.classDays, groupId: cohort.groupId }} />
    </>
  );
}
