import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/access";

/** The picture of a school's certificate design: for the school's members, and for anyone whose own
 *  certificate is printed on it. The picture behind an id never changes, so the browser keeps it. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const design = await db.query.certificateDesigns.findFirst({ where: eq(schema.certificateDesigns.id, id) });
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!design) return notFound();
  const [member, own] = await Promise.all([
    db.query.memberships.findFirst({ where: and(eq(schema.memberships.userId, user.id), eq(schema.memberships.orgId, design.orgId)), columns: { id: true } }),
    db.select({ id: schema.certificates.id }).from(schema.certificates)
      .innerJoin(schema.enrollments, eq(schema.enrollments.id, schema.certificates.enrollmentId))
      .where(and(eq(schema.certificates.designId, design.id), eq(schema.enrollments.userId, user.id))).limit(1),
  ]);
  if (!member && !own.length) return notFound();
  return new Response(new Uint8Array(design.image), {
    headers: {
      "Content-Type": design.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
