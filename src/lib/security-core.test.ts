import { describe, expect, it } from "vitest";
import { canJudgeWork, canResetPassword, deleteScope, inviteCodeFromNext, inviteUsable, loginLock, roleAfterInvite, type Admin, type Person } from "./security-core";
import { actionLabel, actionsIn, cleanDetail } from "./audit-core";

const now = new Date("2026-10-10T10:00:00Z");
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("loginLock", () => {
  it("allows 4 wrong passwords, locks on the 5th", () => {
    expect(loginLock([1, 2, 3, 4].map(minsAgo), now).locked).toBe(false);
    expect(loginLock([1, 2, 3, 4, 5].map(minsAgo), now)).toEqual({ locked: true, minutesLeft: 10 });
  });
  it("forgets wrong passwords older than 15 minutes", () => {
    expect(loginLock([1, 2, 3, 4, 16, 20].map(minsAgo), now).locked).toBe(false);
  });
  it("counts the wait from the 5th most recent try", () => {
    expect(loginLock([0, 1, 2, 3, 14, 14.5].map(minsAgo), now)).toEqual({ locked: true, minutesLeft: 1 });
  });
});

describe("roleAfterInvite", () => {
  it("raises a role, never lowers it", () => {
    expect(roleAfterInvite(null, "STUDENT")).toBe("STUDENT");
    expect(roleAfterInvite("STUDENT", "INSTRUCTOR")).toBe("INSTRUCTOR");
    expect(roleAfterInvite("ADMIN", "STUDENT")).toBe("ADMIN");
    expect(roleAfterInvite("INSTRUCTOR", "INSTRUCTOR")).toBe("INSTRUCTOR");
  });
});

const admin: Admin = { id: "me", adminOf: ["a"] };
const person = (over: Partial<Person> = {}): Person => ({ id: "p", isSuperAdmin: false, memberships: [{ orgId: "a", role: "STUDENT" }], ...over });

describe("canResetPassword", () => {
  it("lets an admin reset someone only in their school", () => expect(canResetPassword(admin, person())).toBe(true));
  it("not someone who is also in another school", () =>
    expect(canResetPassword(admin, person({ memberships: [{ orgId: "a", role: "STUDENT" }, { orgId: "b", role: "ADMIN" }] }))).toBe(false));
  it("unless the admin runs that school too", () =>
    expect(canResetPassword({ ...admin, adminOf: ["a", "b"] }, person({ memberships: [{ orgId: "a", role: "STUDENT" }, { orgId: "b", role: "STUDENT" }] }))).toBe(true));
  it("lets the platform admin help anyone else", () => {
    expect(canResetPassword({ id: "me", adminOf: [], isSuperAdmin: true }, person({ memberships: [{ orgId: "b", role: "ADMIN" }] }))).toBe(true);
    expect(canResetPassword({ id: "me", adminOf: [], isSuperAdmin: true }, person({ isSuperAdmin: true }))).toBe(false);
  });
  it("never a platform admin, yourself, or someone in no school", () => {
    expect(canResetPassword(admin, person({ isSuperAdmin: true }))).toBe(false);
    expect(canResetPassword(admin, person({ id: "me" }))).toBe(false);
    expect(canResetPassword(admin, person({ memberships: [] }))).toBe(false);
  });
});

describe("deleteScope", () => {
  it("deletes the whole account of someone only in this school", () => expect(deleteScope(admin, person(), "a", 1)).toBe("account"));
  it("deletes only this school's part for someone in other schools too", () =>
    expect(deleteScope(admin, person({ memberships: [{ orgId: "a", role: "STUDENT" }, { orgId: "b", role: "STUDENT" }] }), "a", 1)).toBe("school"));
  it("refuses yourself, a platform admin, an outsider, and the last admin", () => {
    expect(deleteScope(admin, person({ id: "me" }), "a", 2)).toBeNull();
    expect(deleteScope(admin, person({ isSuperAdmin: true }), "a", 2)).toBeNull();
    expect(deleteScope(admin, person({ memberships: [{ orgId: "b", role: "STUDENT" }] }), "a", 2)).toBeNull();
    expect(deleteScope(admin, person({ memberships: [{ orgId: "a", role: "ADMIN" }] }), "a", 1)).toBeNull();
    expect(deleteScope(admin, person({ memberships: [{ orgId: "a", role: "ADMIN" }] }), "a", 2)).toBe("account");
  });
  it("only for an admin of that school", () => expect(deleteScope({ id: "me", adminOf: ["b"] }, person(), "a", 1)).toBeNull());
});

describe("sign-up by invite only", () => {
  it("finds the invite code only in a /join/<code> address", () => {
    expect(inviteCodeFromNext("/join/K7mx2pq9ta")).toBe("k7mx2pq9ta");
    expect(inviteCodeFromNext("/dashboard")).toBeNull();
    expect(inviteCodeFromNext("/join")).toBeNull();
    expect(inviteCodeFromNext("/join/abc/../x")).toBeNull();
    expect(inviteCodeFromNext("https://evil.example/join/k7mx2pq9ta")).toBeNull();
  });
  it("an invite is usable only before it expires and while uses are left", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    expect(inviteUsable({ expiresAt: new Date("2026-10-20"), uses: 0, maxUses: 1 }, now)).toBe(true);
    expect(inviteUsable({ expiresAt: null, uses: 4, maxUses: 5 }, now)).toBe(true);
    expect(inviteUsable({ expiresAt: new Date("2026-10-01"), uses: 0, maxUses: 1 }, now)).toBe(false);
    expect(inviteUsable({ expiresAt: null, uses: 1, maxUses: 1 }, now)).toBe(false);
    expect(inviteUsable(null, now)).toBe(false);
  });
});

describe("canJudgeWork", () => {
  it("never on your own work", () => {
    expect(canJudgeWork("t", "t")).toBe(false);
    expect(canJudgeWork("t", "s")).toBe(true);
  });
});

describe("audit", () => {
  it("groups and labels actions", () => {
    expect(actionsIn("work")).toContain("review.verify");
    expect(actionLabel("member.role")).toBe("Changed a role");
    expect(actionLabel("unknown.thing")).toBe("unknown.thing");
  });
  it("keeps details to one short line", () => {
    expect(cleanDetail("a\n\n  b")).toBe("a b");
    expect(cleanDetail("x".repeat(300))).toHaveLength(200);
  });
});
