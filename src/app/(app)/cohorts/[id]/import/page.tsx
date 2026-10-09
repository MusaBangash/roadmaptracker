import { requireTeachableCohort } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { ImportStudents } from "@/components/import-students";

export const metadata = { title: "Add students from a file" };

/** Step 5, feature 1: add a whole class at once from a CSV file (teachers of the cohort and admins). */
export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cohort } = await requireTeachableCohort(id);
  return (
    <>
      <PageHeader title="Add students from a file" sub={cohort.name} back={{ href: `/cohorts/${cohort.id}`, label: cohort.name }} />
      <ImportStudents cohortId={cohort.id} cohortName={cohort.name} />
    </>
  );
}
