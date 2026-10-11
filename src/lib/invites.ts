import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { inviteCodeFromNext, inviteUsable } from "@/lib/security-core";

/**
 * Sign-up is by invite only: a new account (password or Google) needs a real invite that is not
 * expired or used up. `next` is where sign-up returns to, the invite's "/join/<code>" page.
 */
export async function signupInvite(next: string) {
  const code = inviteCodeFromNext(next);
  if (!code) return null;
  const invite = await db.query.invites.findFirst({ where: eq(schema.invites.code, code) });
  return invite && inviteUsable(invite, new Date()) ? invite : null;
}

/** Cookie that carries the invite through Google's sign-in page (Google sign-up only). */
export const INVITE_COOKIE = "noor_invite";
