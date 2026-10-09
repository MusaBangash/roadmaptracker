// NoorAI Tracks — multi-school progress tracking for roadmaps and courses.
import { sql } from "drizzle-orm";
import { pgTable, pgEnum, text, timestamp, integer, boolean, jsonb, real, date, primaryKey, uniqueIndex, index } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { TrackDoc } from "@/lib/roadmap-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const created = () => timestamp("created_at", { mode: "date" }).notNull().defaultNow();

// ---------- Auth.js tables (names required by @auth/drizzle-adapter) ----------
export const users = pgTable("user", {
  id: id(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  /** Raised when the password is reset: every login made before it stops working. */
  sessionVersion: integer("session_version").notNull().default(0),
  /** When the person agreed to the Privacy notice; null = not yet (asked on next visit). */
  consentAt: timestamp("consent_at", { mode: "date" }),
  /** "en" or "ur" (feature 5): the interface language, the same on every device. Null = not chosen yet. */
  locale: text("locale"),
  createdAt: created(),
});

export const accounts = pgTable("account", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccountType>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

// ---------- Schools ----------
export const roleEnum = pgEnum("role", ["ADMIN", "INSTRUCTOR", "STUDENT"]);
export type Role = (typeof roleEnum.enumValues)[number];

export const organizations = pgTable("organization", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: created(),
});

export const memberships = pgTable("membership", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  createdAt: created(),
}, (t) => [uniqueIndex("membership_user_org").on(t.userId, t.orgId), index("membership_org_role").on(t.orgId, t.role)]);

// ---------- Content (official roadmaps synced from content/tracks/*.json; schools' own from the Roadmap Builder) ----------
export const itemKindEnum = pgEnum("item_kind", ["LESSON", "PROJECT", "DELIVERABLE", "MILESTONE"]);

export const tracks = pgTable("track", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("ROLE"),
  edition: text("edition").notNull().default(""),
  subtitle: text("subtitle").notNull().default(""),
  summary: text("summary").notNull().default(""),
  expert: text("expert").notNull().default(""),
  benchmarks: jsonb("benchmarks").$type<{ title: string; detail: string }[]>().notNull().default([]),
  rubric: jsonb("rubric").$type<{ criterion: string; levels: string[] }[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  // Roadmap Builder: null owner = an official NoorAI roadmap (content/tracks/*.json, file-only).
  // A school's own roadmap has an owner; edits wait in `draft` until the school publishes them.
  ownerOrgId: text("owner_org_id").references(() => organizations.id, { onDelete: "cascade" }),
  status: text("status").$type<"DRAFT" | "PUBLISHED">().notNull().default("PUBLISHED"),
  draft: jsonb("draft").$type<TrackDoc>(),
  publishedAt: timestamp("published_at", { mode: "date" }),
}, (t) => [index("track_owner").on(t.ownerOrgId)]);

export const stages = pgTable("stage", {
  id: id(),
  trackId: text("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  order: integer("order").notNull(),
  title: text("title").notNull(),
  level: text("level").notNull().default(""),
  weeks: integer("weeks").notNull().default(0),
  benchmark: text("benchmark").notNull().default(""),
  goal: text("goal").notNull().default(""),
  doneWhen: text("done_when").notNull().default(""),
  resources: text("resources").notNull().default(""),
  optional: boolean("optional").notNull().default(false),
  choiceGroup: text("choice_group"),
  archived: boolean("archived").notNull().default(false),
}, (t) => [uniqueIndex("stage_track_key").on(t.trackId, t.key)]);

export const items = pgTable("item", {
  id: id(),
  stageId: text("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  order: integer("order").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  kind: itemKindEnum("kind").notNull().default("LESSON"),
  group: text("group"),
  optional: boolean("optional").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
}, (t) => [uniqueIndex("item_stage_key").on(t.stageId, t.key)]);

export const orgTracks = pgTable("org_track", {
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  trackId: text("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.orgId, t.trackId] })]);

// ---------- Cohorts & progress ----------
export const cohorts = pgTable("cohort", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  trackId: text("track_id").notNull().references(() => tracks.id),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "date" }).notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: created(),
}, (t) => [index("cohort_org").on(t.orgId)]);

export const cohortInstructors = pgTable("cohort_instructor", {
  cohortId: text("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.cohortId, t.userId] })]);

export const invites = pgTable("invite", {
  id: id(),
  code: text("code").notNull().unique(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  cohortId: text("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
  maxUses: integer("max_uses").notNull().default(50),
  uses: integer("uses").notNull().default(0),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
});

export const enrollmentStatusEnum = pgEnum("enrollment_status", ["ACTIVE", "PAUSED", "COMPLETED", "WITHDRAWN"]);

export const enrollments = pgTable("enrollment", {
  id: id(),
  cohortId: text("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: enrollmentStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: created(),
}, (t) => [uniqueIndex("enrollment_cohort_user").on(t.cohortId, t.userId)]);

export const progressStatusEnum = pgEnum("progress_status", ["DONE", "VERIFIED", "NEEDS_WORK"]);
export type ProgressStatus = (typeof progressStatusEnum.enumValues)[number];

export const itemProgress = pgTable("item_progress", {
  id: id(),
  enrollmentId: text("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  status: progressStatusEnum("status").notNull().default("DONE"),
  evidenceUrl: text("evidence_url"),
  note: text("note"),
  completedAt: timestamp("completed_at", { mode: "date" }).notNull().defaultNow(),
  reviewedById: text("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { mode: "date" }),
  reviewNote: text("review_note"),
  /** Set when a teacher ticked this for a student who was present in class (Teaching plan);
   *  null when the student ticked it. Cleared when the student adds their own evidence. */
  markedById: text("marked_by_id").references(() => users.id, { onDelete: "set null" }),
  /** Comments: when the student last read this item's thread, and when any of the cohort's teachers did. */
  studentSeenAt: timestamp("student_seen_at", { mode: "date" }),
  staffSeenAt: timestamp("staff_seen_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => [uniqueIndex("progress_enrollment_item").on(t.enrollmentId, t.itemId), index("progress_enrollment").on(t.enrollmentId)]);

export const stageSignoffs = pgTable("stage_signoff", {
  id: id(),
  enrollmentId: text("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  stageId: text("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
  passed: boolean("passed").notNull(),
  notes: text("notes"),
  signedById: text("signed_by_id").references(() => users.id, { onDelete: "set null" }),
  signedAt: timestamp("signed_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => [uniqueIndex("signoff_enrollment_stage").on(t.enrollmentId, t.stageId)]);

export const assessments = pgTable("assessment", {
  id: id(),
  enrollmentId: text("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: date("date", { mode: "date" }).notNull(),
  scores: jsonb("scores").$type<Record<string, number[]>>().notNull().default({}),
  average: real("average"),
  passed: boolean("passed"),
  notes: text("notes"),
  assessorId: text("assessor_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
});

export const weeklyLogs = pgTable("weekly_log", {
  id: id(),
  enrollmentId: text("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  weekStart: date("week_start", { mode: "string" }).notNull(),
  hours: real("hours").notNull().default(0),
  finished: text("finished").notNull().default(""),
  stuck: text("stuck").notNull().default(""),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => [uniqueIndex("weekly_enrollment_week").on(t.enrollmentId, t.weekStart)]);

export const attendance = pgTable("attendance", {
  id: id(),
  enrollmentId: text("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  present: boolean("present").notNull(),
}, (t) => [uniqueIndex("attendance_enrollment_date").on(t.enrollmentId, t.date)]);

// ---------- Teaching plan ----------

/** A lesson a teacher has taught to one cohort: when and by whom. One row per cohort and lesson. */
export const cohortCoverage = pgTable("cohort_coverage", {
  id: id(),
  cohortId: text("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  taughtOn: date("taught_on", { mode: "string" }).notNull(),
  taughtById: text("taught_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
}, (t) => [uniqueIndex("coverage_cohort_item").on(t.cohortId, t.itemId)]);

// ---------- Production hardening (Step 4) ----------

/** Activity log: who did what, when. Rows are only ever added. Names are not copied in, so a
 *  deleted person shows as "Deleted person" (actor/subject set null). */
export const auditLog = pgTable("audit_log", {
  id: id(),
  orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  /** e.g. "member.role", "review.verify", "roadmap.publish" — see AUDIT_ACTIONS in src/lib/audit-core.ts */
  action: text("action").notNull(),
  /** The person the change was about, if any (a student whose work was verified, a member whose role changed). */
  subjectId: text("subject_id").references(() => users.id, { onDelete: "set null" }),
  /** Plain-English detail without personal data, e.g. "Instructor → Admin" or "“Build a page”". */
  detail: text("detail").notNull().default(""),
  createdAt: created(),
}, (t) => [index("audit_org_time").on(t.orgId, t.createdAt), index("audit_actor").on(t.actorId)]);

/** Sign-in attempts with a password, for the 5-tries limit. Old rows are pruned. */
export const loginAttempts = pgTable("login_attempt", {
  id: id(),
  email: text("email").notNull(),
  ip: text("ip"),
  ok: boolean("ok").notNull(),
  createdAt: created(),
}, (t) => [index("login_attempt_email_time").on(t.email, t.createdAt), index("login_attempt_ip_time").on(t.ip, t.createdAt)]);

/** One-time password reset links made by a school admin. Only a hash of the token is stored. */
export const passwordResets = pgTable("password_reset", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** The school whose admin made the link (for the activity log). */
  orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
});

// ---------- Certificates (Step 5, feature 2) ----------

/** A certificate for finishing a roadmap. The printed details are copied in when it is issued, so it
 *  reads the same forever even if the roadmap, the school or the account name changes later.
 *  Deleting the student (or their enrollment) deletes it too. At most one valid one per enrollment. */
export const certificates = pgTable("certificate", {
  id: id(),
  /** The public check code, e.g. "7K3MQ-9TXWA" (unguessable; shown on the certificate and in its QR code). */
  code: text("code").notNull().unique(),
  enrollmentId: text("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  nameOnCertificate: text("name_on_certificate").notNull(),
  trackTitle: text("track_title").notNull(),
  trackEdition: text("track_edition").notNull().default(""),
  schoolName: text("school_name").notNull(),
  cohortName: text("cohort_name").notNull(),
  completedOn: date("completed_on", { mode: "string" }).notNull(),
  issuedById: text("issued_by_id").references(() => users.id, { onDelete: "set null" }),
  issuedByName: text("issued_by_name").notNull(),
  issuedAt: created(),
  revokedAt: timestamp("revoked_at", { mode: "date" }),
  revokedById: text("revoked_by_id").references(() => users.id, { onDelete: "set null" }),
  revokeReason: text("revoke_reason"),
}, (t) => [
  index("certificate_enrollment").on(t.enrollmentId),
  uniqueIndex("certificate_one_valid").on(t.enrollmentId).where(sql`"revoked_at" is null`),
]);

export const commentKindEnum = pgEnum("comment_kind", ["COMMENT", "VERIFIED", "NEEDS_WORK", "RESUBMIT"]);
export type CommentKind = (typeof commentKindEnum.enumValues)[number];
export const commentRoleEnum = pgEnum("comment_role", ["STUDENT", "TEACHER"]);

/** The conversation on one piece of a student's work (an enrollment + a project, deliverable or
 *  milestone). Review decisions and resubmissions are rows too, so the history is never overwritten.
 *  Deleting the enrollment deletes the thread; a deleted author shows as "Deleted person". */
export const comments = pgTable("comment", {
  id: id(),
  enrollmentId: text("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  /** The side the author wrote for: the student, or the cohort's teachers and admins. */
  authorRole: commentRoleEnum("author_role").notNull(),
  kind: commentKindEnum("kind").notNull().default("COMMENT"),
  body: text("body"),
  createdAt: created(),
  editedAt: timestamp("edited_at", { mode: "date" }),
  hiddenAt: timestamp("hidden_at", { mode: "date" }),
  hiddenById: text("hidden_by_id").references(() => users.id, { onDelete: "set null" }),
}, (t) => [
  index("comment_thread").on(t.enrollmentId, t.itemId, t.createdAt),
  index("comment_author_time").on(t.authorId, t.createdAt),
]);
