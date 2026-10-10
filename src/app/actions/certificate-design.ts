"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { audit } from "@/lib/audit";
import { DEFAULT_LAYOUT, DESIGN_MAX_BYTES, designProblem, imageInfo, parseLayout } from "@/lib/certificate-design-core";
import { currentDesign } from "@/lib/certificate-designs";
import type { FormState } from "./auth";

const PAGE = "/admin/certificate-design";

/** Story 1: an admin uploads the school's empty certificate picture. A new picture keeps the values
 *  where they were on the old one (usually the same design, fixed); certificates already issued keep
 *  their own picture. */
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
  await db.transaction(async (tx) => {
    await tx.update(schema.certificateDesigns).set({ current: false })
      .where(and(eq(schema.certificateDesigns.orgId, ctx.org.id), eq(schema.certificateDesigns.current, true)));
    await tx.insert(schema.certificateDesigns).values({
      orgId: ctx.org.id, image: Buffer.from(bytes), mime: info.mime, width: info.width, height: info.height,
      layout: before?.layout ?? DEFAULT_LAYOUT, current: true, createdById: ctx.user.id,
    });
    await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.design", detail: `${info.width} × ${info.height} ${info.mime === "image/png" ? "PNG" : "JPG"}` }, tx);
  });
  revalidatePath(PAGE);
  return { ok: before ? "New picture saved. The values stayed where they were: check them below." : "Saved. Now drag each value to its place on the design." };
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

/** Story 1: go back to the plain NoorAI certificate for new certificates (issued ones keep their design). */
export async function stopDesignAction(): Promise<void> {
  const ctx = await requireRole(["ADMIN"]);
  const off = await db.update(schema.certificateDesigns).set({ current: false })
    .where(and(eq(schema.certificateDesigns.orgId, ctx.org.id), eq(schema.certificateDesigns.current, true)))
    .returning({ id: schema.certificateDesigns.id });
  if (off.length) await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.design_off" });
  revalidatePath(PAGE);
}
