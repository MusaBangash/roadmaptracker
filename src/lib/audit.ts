import "server-only";
import { db, schema } from "@/db";
import { cleanDetail, type AuditAction } from "@/lib/audit-core";

type Q = Pick<typeof db, "insert">;

/** Adds one row to the activity log (Story 3). Rows are never changed or deleted by the app. */
export async function audit(
  entry: { orgId: string | null; actorId: string | null; action: AuditAction; subjectId?: string | null; detail?: string },
  q: Q = db,
) {
  await q.insert(schema.auditLog).values({
    orgId: entry.orgId, actorId: entry.actorId, action: entry.action, subjectId: entry.subjectId ?? null, detail: cleanDetail(entry.detail ?? ""),
  });
}
