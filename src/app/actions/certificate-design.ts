"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { audit } from "@/lib/audit";
import { DEFAULT_LAYOUT, DESIGN_MAX_BYTES, designProblem, imageInfo, onlineProblem, parseLayout } from "@/lib/certificate-design-core";
import { certificatesOn, currentDesign } from "@/lib/certificate-designs";
import type { FormState } from "./auth";

const PAGE = "/admin/certificate-design";

/** Story 1: an admin uploads the school's empty certificate picture. A new picture keeps the values
 *  where they were on the old one (usually the same design, fixed). The old one stays only if
 *  certificates were printed on it (they keep their own picture); an unused one is deleted. The online
 *  version belongs to the old picture, so it has to be uploaded again for the new one. */
export async function uploadDesignAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: designProblem(null, 0)! };
  if (file.size > DESIGN_MAX_BYTES) return { error: designProblem(null, file.size)! };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = imageInfo(bytes);
  const problem = designProblem(info, bytes.length);
  if (problem || !info) return { error: problem ?? designProblem(null, 1)! };
  const before = await currentDesign(ctx.org.id);
  const oldUsed = before ? await certificatesOn(before.id) : 0;
  await db.transaction(async (tx) => {
    if (before && !oldUsed) {
      await tx.delete(schema.certificateDesigns).where(and(eq(schema.certificateDesigns.id, before.id), eq(schema.certificateDesigns.orgId, ctx.org.id),
        sql`not exists (select 1 from "certificate" where "certificate"."design_id" = "certificate_design"."id")`));
    }
    await tx.update(schema.certificateDesigns).set({ current: false })
      .where(and(eq(schema.certificateDesigns.orgId, ctx.org.id), eq(schema.certificateDesigns.current, true)));
    await tx.insert(schema.certificateDesigns).values({
      orgId: ctx.org.id, image: Buffer.from(bytes), mime: info.mime, width: info.width, height: info.height,
      layout: before?.layout ?? DEFAULT_LAYOUT, current: true, createdById: ctx.user.id,
    });
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.design", detail: `${info.width} × ${info.height} ${info.mime === "image/png" ? "PNG" : "JPG"}` }, tx);
  });
  revalidatePath(PAGE);
  return { ok: before
    ? `New picture saved. The values stayed where they were: check them below.${before.onlineUpdatedAt ? " Upload the online version again too." : ""}`
    : "Saved. Now drag each value to its place on the design." };
}

/** Option B: the online version of the same design (students' PDF), e.g. without the signature lines.
 *  It replaces the old online version for every certificate on this design. */
export async function uploadOnlineAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  const design = await currentDesign(ctx.org.id);
  if (!design) return { error: "Upload the print version first." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: designProblem(null, 0)! };
  if (file.size > DESIGN_MAX_BYTES) return { error: designProblem(null, file.size)! };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = imageInfo(bytes);
  const problem = onlineProblem(design, info, bytes.length);
  if (problem || !info) return { error: problem ?? designProblem(null, 1)! };
  await db.update(schema.certificateDesigns).set({ onlineImage: Buffer.from(bytes), onlineMime: info.mime, onlineUpdatedAt: new Date() })
    .where(and(eq(schema.certificateDesigns.id, design.id), eq(schema.certificateDesigns.orgId, ctx.org.id)));
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.design_online", detail: `uploaded, ${info.width} × ${info.height}` });
  revalidatePath(PAGE);
  return { ok: "Online version saved. Students' PDFs use it; printing for signing uses the print version." };
}

/** Option B: back to one picture for both copies. */
export async function removeOnlineAction(): Promise<void> {
  const ctx = await requireRole(["ADMIN"]);
  const [off] = await db.update(schema.certificateDesigns).set({ onlineImage: null, onlineMime: null, onlineUpdatedAt: null })
    .where(and(eq(schema.certificateDesigns.orgId, ctx.org.id), eq(schema.certificateDesigns.current, true)))
    .returning({ id: schema.certificateDesigns.id });
  if (off) await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.design_online", detail: "removed" });
  revalidatePath(PAGE);
}

/** Story 2: save where the values sit. Only the school's current design; issued certificates keep a copy
 *  of the layout they were printed with, so this never changes them. */
export async function saveLayoutAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  const layout = parseLayout(String(form.get("layout") ?? ""));
  if (!layout) return { error: "Something about the layout isn't right. Reload the page and try again." };
  const [saved] = await db.update(schema.certificateDesigns).set({ layout })
    .where(and(eq(schema.certificateDesigns.id, String(form.get("designId") ?? "")), eq(schema.certificateDesigns.orgId, ctx.org.id), eq(schema.certificateDesigns.current, true)))
    .returning({ id: schema.certificateDesigns.id });
  if (!saved) return { error: "This design was replaced meanwhile. Reload the page." };
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.design_layout" });
  revalidatePath(PAGE);
  return { ok: "Saved. New certificates use these places." };
}

/** Remove the design: deleted completely when no certificate was printed on it (a test or wrong
 *  picture); otherwise only stopped, because those certificates keep it. New certificates go back to the
 *  plain NoorAI design either way. */
export async function removeDesignAction(): Promise<void> {
  const ctx = await requireRole(["ADMIN"]);
  const design = await currentDesign(ctx.org.id);
  if (!design) redirect(PAGE);
  // The delete re-checks "no certificate uses it" itself, so a certificate issued a moment ago is safe.
  const gone = await db.delete(schema.certificateDesigns)
    .where(and(eq(schema.certificateDesigns.id, design.id), eq(schema.certificateDesigns.orgId, ctx.org.id),
      sql`not exists (select 1 from "certificate" where "certificate"."design_id" = "certificate_design"."id")`))
    .returning({ id: schema.certificateDesigns.id });
  if (gone.length) {
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.design_delete" });
    revalidatePath(PAGE);
    redirect(`${PAGE}?removed=deleted`);
  }
  await db.update(schema.certificateDesigns).set({ current: false }).where(eq(schema.certificateDesigns.id, design.id));
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.design_off" });
  revalidatePath(PAGE);
  redirect(`${PAGE}?removed=kept&n=${await certificatesOn(design.id)}`);
}
