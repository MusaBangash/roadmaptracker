import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { CohortForm } from "@/components/cohort-form";
import { loadGroups } from "@/lib/groups";
import { schoolToday } from "@/lib/utils";

export const metadata = { title: "New cohort" };

export default async function NewCohortPage() {
  const ctx = await requireRole(["ADMIN"]);
  const tracks = await db.select({ id: schema.tracks.id, title: schema.tracks.title, edition: schema.tracks.edition })
    .from(schema.orgTracks).innerJoin(schema.tracks, eq(schema.orgTracks.trackId, schema.tracks.id))
    .where(eq(schema.orgTracks.orgId, ctx.org.id)).orderBy(schema.tracks.title);
  const staff = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.memberships).innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.memberships.orgId, ctx.org.id), inArray(schema.memberships.role, ["ADMIN", "INSTRUCTOR"])))
    .orderBy(schema.users.name);
  return (
    <>
      <PageHeader title="New cohort" sub="A cohort is one group of students following one track, starting on one date." back={{ href: "/cohorts", label: "Cohorts" }} />
      <CohortForm tracks={tracks} staff={staff} today={schoolToday()} groups={await loadGroups(ctx.org.id)} />
    </>
  );
}
