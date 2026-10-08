"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db, schema } from "@/db";
import { requireUser, ORG_COOKIE } from "@/lib/access";

export type FormState = { error?: string; ok?: string } | undefined;

function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: safeNext(form.get("next")),
    });
  } catch (e) {
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
  const { name, email, password } = parsed.data;
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return { error: "An account with this email already exists. Sign in instead." };
  await db.insert(schema.users).values({ name, email, passwordHash: await bcrypt.hash(password, 12) });
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

  await db.transaction(async (tx) => {
    const existing = await tx.query.memberships.findFirst({
      where: and(eq(schema.memberships.userId, user.id), eq(schema.memberships.orgId, invite.orgId)),
    });
    if (!existing) await tx.insert(schema.memberships).values({ userId: user.id, orgId: invite.orgId, role: invite.role });
    if (invite.cohortId) {
      if (invite.role === "STUDENT") {
        await tx.insert(schema.enrollments).values({ cohortId: invite.cohortId, userId: user.id }).onConflictDoNothing();
      } else {
        await tx.insert(schema.cohortInstructors).values({ cohortId: invite.cohortId, userId: user.id }).onConflictDoNothing();
      }
    }
    await tx.update(schema.invites).set({ uses: sql`${schema.invites.uses} + 1` }).where(eq(schema.invites.id, invite.id));
  });
  (await cookies()).set(ORG_COOKIE, invite.orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
