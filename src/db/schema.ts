// NoorAI Tracks — multi-school progress tracking for roadmaps and courses.
import { pgTable, pgEnum, text, timestamp, integer, boolean, jsonb, real, date, primaryKey, uniqueIndex, index } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

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

// ---------- Content (synced from content/tracks/*.json) ----------
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
});

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
  createdById: text("created_by_id").notNull().references(() => users.id),
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
  reviewedById: text("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { mode: "date" }),
  reviewNote: text("review_note"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => [uniqueIndex("progress_enrollment_item").on(t.enrollmentId, t.itemId), index("progress_enrollment").on(t.enrollmentId)]);

export const stageSignoffs = pgTable("stage_signoff", {
  id: id(),
  enrollmentId: text("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  stageId: text("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
  passed: boolean("passed").notNull(),
  notes: text("notes"),
  signedById: text("signed_by_id").notNull().references(() => users.id),
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
  assessorId: text("assessor_id").notNull().references(() => users.id),
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
