// Production-hardening rules (Step 4), pure and tested in security-core.test.ts.
import type { Role } from "@/db/schema";

// ---------- Story 1: password guessing ----------

export const LOGIN_LIMIT = { tries: 5, minutes: 15, perIp: 30 } as const;

/** Locked when there were `tries` wrong passwords in the last `minutes`; unlocks `minutes` after
 *  the oldest of those. `failures` are times of wrong passwords since the last correct one. */
export function loginLock(failures: Date[], now: Date, tries: number = LOGIN_LIMIT.tries, minutes: number = LOGIN_LIMIT.minutes) {
  const windowMs = minutes * 60_000;
  const recent = failures.filter((d) => now.getTime() - d.getTime() < windowMs).sort((a, b) => b.getTime() - a.getTime());
  if (recent.length < tries) return { locked: false as const, minutesLeft: 0 };
  const unlockAt = recent[tries - 1].getTime() + windowMs;
  return { locked: true as const, minutesLeft: Math.max(1, Math.ceil((unlockAt - now.getTime()) / 60_000)) };
}

// ---------- Story 5: invites ----------

const RANK: Record<Role, number> = { STUDENT: 0, INSTRUCTOR: 1, ADMIN: 2 };

/** A member's role after using an invite: it can go up, never down. */
export function roleAfterInvite(current: Role | null, invited: Role): Role {
  if (!current) return invited;
  return RANK[invited] > RANK[current] ? invited : current;
}

// ---------- Story 2: reset links, Story 7: deleting a person ----------

export type Person = { id: string; isSuperAdmin: boolean; memberships: { orgId: string; role: Role }[] };
export type Admin = { id: string; adminOf: string[]; isSuperAdmin?: boolean };

/** A school admin may make a password reset link for someone only if every school that person is
 *  in is one the admin runs, so no admin can take over an account another school depends on.
 *  Never for a platform admin; not for yourself (you know your password, or ask another admin).
 *  The platform admin (NoorAI) may make one for anyone else. */
export function canResetPassword(admin: Admin, target: Person) {
  if (target.isSuperAdmin || target.id === admin.id) return false;
  if (admin.isSuperAdmin) return true; // the platform admin can help anyone else
  if (!target.memberships.length) return false;
  return target.memberships.every((m) => admin.adminOf.includes(m.orgId));
}

/**
 * What "delete this person's data" does in school `orgId`:
 *  - "account": they are only in this school → delete the whole account and everything with it;
 *  - "school":  they are also in other schools → delete only their place and work in this school;
 *  - null:      not allowed (yourself, a platform admin, not in this school, or the last admin).
 */
export function deleteScope(admin: Admin, target: Person, orgId: string, adminsInOrg: number): "account" | "school" | null {
  if (!admin.adminOf.includes(orgId) || target.id === admin.id || target.isSuperAdmin) return null;
  const here = target.memberships.find((m) => m.orgId === orgId);
  if (!here) return null;
  if (here.role === "ADMIN" && adminsInOrg <= 1) return null;
  return target.memberships.length === 1 ? "account" : "school";
}

// ---------- Story 4: nobody checks their own work ----------

/** Verify, send back, sign off or assess: never on your own enrollment. */
export function canJudgeWork(viewerId: string, enrollmentUserId: string) {
  return viewerId !== enrollmentUserId;
}
