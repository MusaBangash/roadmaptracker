"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { signIn } from "@/auth";
import { requireUser } from "@/lib/access";
import { audit } from "@/lib/audit";
import { clientIp, loginLockFor, recordLogin } from "@/lib/login-guard";
import type { FormState } from "./auth";

// My account: everyone changes their own name and password here.

const nameSchema = z.string().trim().min(2, "Type your full name (2 to 80 characters).").max(80, "Type your full name (2 to 80 characters).");

export async function updateMyNameAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = nameSchema.safeParse(form.get("name"));
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data === user.name) return { ok: "Nothing changed." };
  await db.update(schema.users).set({ name: p.data }).where(eq(schema.users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: "Your name is saved." };
}

const passwordSchema = z.object({
  current: z.string().max(100),
  password: z.string().min(8, "The new password needs at least 8 characters.").max(100, "The new password is too long."),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "The two new passwords are different. Type the same one twice." });

/**
 * Change (or, with no password yet, set) my password. A wrong current password counts towards the
 * sign-in limit. Every other login stops working (session_version); this device signs in again.
 */
export async function changeMyPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = passwordSchema.safeParse({ current: form.get("current") ?? "", password: form.get("password"), confirm: form.get("confirm") });
  if (!p.success) return { error: p.error.issues[0].message };
  const email = user.email?.toLowerCase().trim() ?? "";
  if (!email) return { error: "Your account has no email, so a password can't be set." };
  if (user.passwordHash) {
    const ip = clientIp(await headers());
    const lock = await loginLockFor(email, ip);
    if (lock.locked) return { error: `Too many wrong passwords. Try again in ${lock.minutesLeft} minute${lock.minutesLeft === 1 ? "" : "s"}.` };
    if (!(await bcrypt.compare(p.data.current, user.passwordHash))) {
      await recordLogin(email, ip, false);
      return { error: "Your current password is wrong." };
    }
    if (p.data.current === p.data.password) return { error: "The new password is the same as the current one." };
  }
  const passwordHash = await bcrypt.hash(p.data.password, 12);
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ passwordHash, sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, user.id));
    await tx.delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, email));
    await audit({ orgId: null, actorId: user.id, action: "password.change", subjectId: user.id }, tx);
  });
  // Older logins are now signed out; sign this device in again with the new password.
  try {
    await signIn("credentials", { email, password: p.data.password, redirectTo: "/account?saved=password" });
  } catch (e) {
    if (e instanceof AuthError) return { ok: "Your password is changed. Please sign in again with the new password." };
    throw e; // the redirect
  }
}
