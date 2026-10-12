// Editing a cohort after it was created, pure and tested in cohort-core.test.ts.

export type CohortFields = { name: string; startDate: string; trackId: string };

/**
 * What an edit changes, as words for the activity log ("name: A → B; start: … → …"), or null when
 * nothing changed. Track titles are passed in so the log reads in names, not ids.
 */
export function cohortChanges(before: CohortFields, after: CohortFields, trackTitle: (id: string) => string) {
  const parts: string[] = [];
  if (before.name !== after.name) parts.push(`name: ${before.name} → ${after.name}`);
  if (before.startDate !== after.startDate) parts.push(`start: ${before.startDate} → ${after.startDate}`);
  if (before.trackId !== after.trackId) parts.push(`track: ${trackTitle(before.trackId)} → ${trackTitle(after.trackId)}`);
  return parts.length ? parts.join("; ") : null;
}

/** The roadmap can change only while nobody is enrolled: students' ticks belong to its lessons. */
export function canChangeTrack(enrolled: number) {
  return enrolled === 0;
}
