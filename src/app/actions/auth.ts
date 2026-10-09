"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { headers } from "next/headers";
import { LoginLocked, signIn, signOut } from "@/auth";
import { clientIp, lockMessage, loginLockFor } from "@/lib/login-guard";
import { roleAfterInvite } from "@/lib/security-core";
import { audit } from "@/lib/audit";
import { hashToken } from "@/lib/reset";
import { db, schema } from "@/db";
import { requireUser, ORG_COOKIE } from "@/lib/access";

export type FormState = { error?: string; ok?: string } | undefined;

function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const lock = await loginLockFor(email, clientIp(await headers()));
  if (lock.locked) return { error: lockMessage(lock.minutesLeft) };
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: safeNext(form.get("next")),
    });
  } catch (e) {
    if (e instanceof LoginLocked || (e instanceof AuthError && (e as { code?: string }).code === "locked")) {
      return { error: lockMessage((await loginLockFor(email, clientIp(await headers()))).minutesLeft || 15) };
    }
    if (e instanceof AuthError) return { error: "That email and password don't match. Check them and try again." };
    throw e; // the success redirect
  }
}

export async function googleAction(form: FormData) {
  await signIn("google", { redirectTo: safeNext(form.get("next")) });
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(100),
});

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (form.get("consent") !== "on") return { error: "Please read and agree to the Privacy notice." };
  const { name, email, password } = parsed.data;
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return { error: "An account with this email already exists. Sign in instead." };
  await db.insert(schema.users).values({ name, email, passwordHash: await bcrypt.hash(password, 12), consentAt: new Date() });
  try {
    await signIn("credentials", { email, password, redirectTo: safeNext(form.get("next")) });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Account created, but sign-in failed. Please sign in." };
    throw e;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function switchOrgAction(form: FormData) {
  const orgId = String(form.get("orgId") ?? "");
  (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}

export async function acceptInviteAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const code = String(form.get("code") ?? "").trim().toLowerCase();
  const invite = await db.query.invites.findFirst({ where: eq(schema.invites.code, code) });
  if (!invite) return { error: "That invite code doesn't exist. Check it with your instructor." };
  if (invite.expiresAt && invite.expiresAt < new Date()) return { error: "This invite has expired. Ask for a new one." };
  if (invite.uses >= invite.maxUses) return { error: "This invite has been used the maximum number of times." };

  const full = await db.transaction(async (tx) => {
    // Story 5: take one use only if one is left, in a single statement, so two people joining at the
    // same moment can never take the last use twice.
    const [taken] = await tx.update(schema.invites).set({ uses: sql`${schema.invites.uses} + 1` })
      .where(and(eq(schema.invites.id, invite.id), lt(schema.invites.uses, schema.invites.maxUses),
        or(isNull(schema.invites.expiresAt), gt(schema.invites.expiresAt, new Date()))))
      .returning({ id: schema.invites.id });
    if (!taken) return true;
    const existing = await tx.query.memberships.findFirst({
      where: and(eq(schema.memberships.userId, user.id), eq(schema.memberships.orgId, invite.orgId)),
    });
    // Story 5: a higher-role invite raises an existing member's role; it never lowers it.
    const role = roleAfterInvite(existing?.role ?? null, invite.role);
    if (!existing) await tx.insert(schema.memberships).values({ userId: user.id, orgId: invite.orgId, role });
    else if (role !== existing.role) await tx.update(schema.memberships).set({ role }).where(eq(schema.memberships.id, existing.id));
    await audit({ orgId: invite.orgId, actorId: user.id, action: "member.join", subjectId: user.id,
      detail: existing && role !== existing.role ? `${existing.role.toLowerCase()} → ${role.toLowerCase()}` : role.toLowerCase() }, tx);
    if (invite.cohortId) {
      if (invite.role === "STUDENT") {
        await tx.insert(schema.enrollments).values({ cohortId: invite.cohortId, userId: user.id }).onConflictDoNothing();
      } else {
        await tx.insert(schema.cohortInstructors).values({ cohortId: invite.cohortId, userId: user.id }).onConflictDoNothing();
      }
    }
    return false;
  });
  if (full) return { error: "This invite has been used the maximum number of times." };
  (await cookies()).set(ORG_COOKIE, invite.orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}

const resetSchema = z.object({
  token: z.string().min(20).max(100),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(100),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "The two passwords don't match.", path: ["confirm"] });

/** Story 2: set a new password with a one-time link. Every older login of this person stops working. */
export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const p = resetSchema.safeParse({ token: form.get("token"), password: form.get("password"), confirm: form.get("confirm") });
  if (!p.success) return { error: p.error.issues[0].message };
  const passwordHash = await bcrypt.hash(p.data.password, 12);
  const done = await db.transaction(async (tx) => {
    // Use the link only once: the update succeeds for exactly one request.
    const [reset] = await tx.update(schema.passwordResets).set({ usedAt: new Date() })
      .where(and(eq(schema.passwordResets.tokenHash, hashToken(p.data.token)), isNull(schema.passwordResets.usedAt), gt(schema.passwordResets.expiresAt, new Date())))
      .returning();
    if (!reset) return null;
    const [user] = await tx.update(schema.users)
      .set({ passwordHash, sessionVersion: sql`${schema.users.sessionVersion} + 1` })
      .where(eq(schema.users.id, reset.userId)).returning({ id: schema.users.id, email: schema.users.email });
    if (user?.email) await tx.delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, user.email));
    await audit({ orgId: reset.orgId, actorId: reset.userId, action: "password.reset", subjectId: reset.userId }, tx);
    return user;
  });
  if (!done) return { error: "This link has expired or was already used. Ask your school admin for a new one." };
  redirect("/login?reset=1");
}

/** Story 7: record that the signed-in person agreed to the Privacy notice. */
export async function consentAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (form.get("consent") !== "on") return { error: "Please read and agree to the Privacy notice to continue." };
  await db.update(schema.users).set({ consentAt: new Date() }).where(eq(schema.users.id, user.id));
  redirect(safeNext(form.get("next")));
}
