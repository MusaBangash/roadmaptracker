// Story 1: limits wrong passwords per email (5 in 15 minutes) and per network address (30).
// Relative imports: used by src/auth.ts, which Auth.js also loads outside React Server Components.
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { LOGIN_LIMIT, loginLock } from "./security-core";

const since = () => new Date(Date.now() - LOGIN_LIMIT.minutes * 60_000);

/** The first address in X-Forwarded-For (set by Vercel), else nothing. */
export function clientIp(headers: Headers | null | undefined) {
  return headers?.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || null;
}

/** Is this email (or this network address) locked out right now? */
export async function loginLockFor(email: string, ip: string | null) {
  const [byEmail, byIp] = await Promise.all([
    db.select({ at: schema.loginAttempts.createdAt }).from(schema.loginAttempts)
      .where(and(eq(schema.loginAttempts.email, email), eq(schema.loginAttempts.ok, false), gt(schema.loginAttempts.createdAt, since()))),
    ip ? db.select({ at: schema.loginAttempts.createdAt }).from(schema.loginAttempts)
      .where(and(eq(schema.loginAttempts.ip, ip), eq(schema.loginAttempts.ok, false), gt(schema.loginAttempts.createdAt, since()))) : [],
  ]);
  const now = new Date();
  const email5 = loginLock(byEmail.map((r) => r.at), now);
  const ip30 = loginLock(byIp.map((r) => r.at), now, LOGIN_LIMIT.perIp);
  return email5.locked ? email5 : ip30;
}

/** Records a wrong password; a correct one clears that email's wrong ones. Prunes old rows. */
export async function recordLogin(email: string, ip: string | null, ok: boolean) {
  if (ok) await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, email));
  else await db.insert(schema.loginAttempts).values({ email, ip, ok: false });
  await db.delete(schema.loginAttempts).where(lt(schema.loginAttempts.createdAt, sql`now() - interval '1 day'`));
}

export function lockMessage(minutesLeft: number) {
  return `Too many wrong passwords. For your safety, sign-in is paused. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}, or ask your school admin for a password reset link.`;
}
