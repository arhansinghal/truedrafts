import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["reader", "writer", "admin"]);
export const essayStatusEnum = pgEnum("essay_status", [
  "pending",
  "approved",
  "rejected",
  "archived",
]);
export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "processing",
  "paid",
  "failed",
]);
export const purchaseStatusEnum = pgEnum("purchase_status", [
  "completed",
  "refunded",
]);
export const essayTypeEnum = pgEnum("essay_type", [
  "common_app",
  "supplemental",
  "why_school",
  "activities",
  "short_answer",
  "other",
]);

// ─── Better Auth Required Tables ─────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  emailVerified: boolean("email_verified").default(false),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Custom fields
  role: userRoleEnum("role").notNull().default("reader"),
  username: text("username").unique(),
  bio: text("bio"),
  profilePhoto: text("profile_photo"),
  polarCustomerId: text("polar_customer_id"),
  verifiedAdmit: boolean("verified_admit").default(false),
  referralCode: text("referral_code").unique(),
  satScore: integer("sat_score"),
  actScore: integer("act_score"),
  gpa: text("gpa"),
  extracurriculars: text("extracurriculars"),
  graduationYear: integer("graduation_year"),
  country: text("country"),
  activities: text("activities").default("[]"), // JSON: [{name, description}]
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── App Tables ───────────────────────────────────────────────────────────────

export const universities = pgTable("universities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  country: text("country").notNull().default("US"),
  displayOrder: integer("display_order").default(0),
});

export const essays = pgTable("essays", {
  id: uuid("id").primaryKey().defaultRandom(),
  writerId: text("writer_id")
    .notNull()
    .references(() => users.id),
  universityId: uuid("university_id")
    .notNull()
    .references(() => universities.id),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  essayType: essayTypeEnum("essay_type").notNull(),
  fullContent: text("full_content").notNull(),
  previewContent: text("preview_content").notNull(),
  wordCount: integer("word_count").notNull().default(0),
  priceCents: integer("price_cents").notNull(),
  status: essayStatusEnum("status").notNull().default("pending"),
  tags: text("tags").array().default([]),
  views: integer("views").notNull().default(0),
  previewOpens: integer("preview_opens").notNull().default(0),
  purchases: integer("purchases").notNull().default(0),
  avgRating: integer("avg_rating").default(0),
  ratingCount: integer("rating_count").default(0),
  polarProductId: text("polar_product_id"),
  rejectionNote: text("rejection_note"),
  admittedYear: integer("admitted_year"),
  essayPrompt: text("essay_prompt"),
  submissionImageUrl: text("submission_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  publishedAt: timestamp("published_at"),
});

export const writerUniversities = pgTable("writer_universities", {
  id: uuid("id").primaryKey().defaultRandom(),
  writerId: text("writer_id")
    .notNull()
    .references(() => users.id),
  universityId: uuid("university_id")
    .notNull()
    .references(() => universities.id),
  admittedYear: integer("admitted_year"),
  applicationProgress: integer("application_progress").default(0),
  verifiedAdmit: boolean("verified_admit").default(false),
});

export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => users.id),
  // One of essayId or applicationId must be set
  essayId: uuid("essay_id").references(() => essays.id),
  applicationId: uuid("application_id").references(() => collegeApplications.id),
  amountCents: integer("amount_cents").notNull(),
  platformFeeCents: integer("platform_fee_cents").notNull(),
  writerPayoutCents: integer("writer_payout_cents").notNull(),
  polarOrderId: text("polar_order_id").unique(),
  status: purchaseStatusEnum("status").notNull().default("completed"),
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

export const writerEarnings = pgTable("writer_earnings", {
  writerId: text("writer_id")
    .primaryKey()
    .references(() => users.id),
  availableCents: integer("available_cents").notNull().default(0),
  pendingCents: integer("pending_cents").notNull().default(0),
  totalEarnedCents: integer("total_earned_cents").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  writerId: text("writer_id")
    .notNull()
    .references(() => users.id),
  amountCents: integer("amount_cents").notNull(),
  polarPayoutId: text("polar_payout_id"),
  status: payoutStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow(),
  paidAt: timestamp("paid_at"),
});

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  essayId: uuid("essay_id")
    .notNull()
    .references(() => essays.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => users.id),
  essayId: uuid("essay_id")
    .notNull()
    .references(() => essays.id),
  score: integer("score").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  curatedBy: text("curated_by").references(() => users.id),
  essayIds: uuid("essay_ids").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const collegeApplications = pgTable("college_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  writerId: text("writer_id").notNull().references(() => users.id),
  universityId: uuid("university_id").notNull().references(() => universities.id),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  admittedYear: integer("admitted_year"),
  priceCents: integer("price_cents").notNull(),
  status: essayStatusEnum("status").notNull().default("pending"),
  // Admission proof
  admissionProofUrl: text("admission_proof_url"),
  // Common App essay
  submittedCommonApp: boolean("submitted_common_app").default(false),
  commonAppPrompt: text("common_app_prompt"),
  commonAppContent: text("common_app_content"),
  commonAppScreenshotUrl: text("common_app_screenshot_url"),
  // Supplemental essays (JSON: [{prompt, content}])
  supplementals: text("supplementals").default("[]"),
  numSupplementals: integer("num_supplementals").default(0),
  // Stats & metadata
  tags: text("tags").array().default([]),
  views: integer("views").notNull().default(0),
  purchases: integer("purchases").notNull().default(0),
  avgRating: integer("avg_rating").default(0),
  ratingCount: integer("rating_count").default(0),
  polarProductId: text("polar_product_id"),
  rejectionNote: text("rejection_note"),
  createdAt: timestamp("created_at").defaultNow(),
  publishedAt: timestamp("published_at"),
  // Vibe Search
  vibeMetadata: text("vibe_metadata"),   // JSON: {tone, core_values, narrative_arc, vibe_summary, themes}
  vibeTone: text("vibe_tone"),           // extracted for SQL filtering
  vibeSearchText: text("vibe_search_text"), // flat string of all AI terms — used for ILIKE vibe search
  // AI Insight Brief — generated once at approval by Python AI service
  insightBrief: text("insight_brief"),   // JSON: {essay_focus, applicant_profile, why_it_worked, tone_signature, standout_quote}
});

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  type: text("type").notNull(), // forgot_password | verify_email | purchase_buyer | purchase_seller | app_approved | app_rejected
  status: text("status").notNull().default("sent"), // sent | failed
  resendId: text("resend_id"),
  metadata: text("metadata").default("{}"),
  error: text("error"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const applicationDrafts = pgTable("application_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  writerId: text("writer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  universityId: uuid("university_id").references(() => universities.id),
  universityName: text("university_name"),
  universitySlug: text("university_slug"),
  currentStep: integer("current_step").notNull().default(1),
  data: text("data").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: text("referrer_id")
    .notNull()
    .references(() => users.id),
  referredUserId: text("referred_user_id")
    .notNull()
    .references(() => users.id),
  bonusCents: integer("bonus_cents").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  essays: many(essays),
  purchases: many(purchases, { relationName: "buyer" }),
  bookmarks: many(bookmarks),
  ratings: many(ratings),
  writerUniversities: many(writerUniversities),
  writerEarnings: many(payouts),
  referralsMade: many(referrals, { relationName: "referrer" }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const universitiesRelations = relations(universities, ({ many }) => ({
  essays: many(essays),
  writerUniversities: many(writerUniversities),
}));

export const essaysRelations = relations(essays, ({ one, many }) => ({
  writer: one(users, { fields: [essays.writerId], references: [users.id] }),
  university: one(universities, { fields: [essays.universityId], references: [universities.id] }),
  purchases: many(purchases),
  bookmarks: many(bookmarks),
  ratings: many(ratings),
}));

export const writerUniversitiesRelations = relations(writerUniversities, ({ one }) => ({
  writer: one(users, { fields: [writerUniversities.writerId], references: [users.id] }),
  university: one(universities, { fields: [writerUniversities.universityId], references: [universities.id] }),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  buyer: one(users, { fields: [purchases.buyerId], references: [users.id], relationName: "buyer" }),
  essay: one(essays, { fields: [purchases.essayId!], references: [essays.id] }),
  application: one(collegeApplications, { fields: [purchases.applicationId!], references: [collegeApplications.id] }),
}));

export const writerEarningsRelations = relations(writerEarnings, ({ one }) => ({
  writer: one(users, { fields: [writerEarnings.writerId], references: [users.id] }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  writer: one(users, { fields: [payouts.writerId], references: [users.id] }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, { fields: [bookmarks.userId], references: [users.id] }),
  essay: one(essays, { fields: [bookmarks.essayId], references: [essays.id] }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  buyer: one(users, { fields: [ratings.buyerId], references: [users.id] }),
  essay: one(essays, { fields: [ratings.essayId], references: [essays.id] }),
}));

export const collectionsRelations = relations(collections, ({ one }) => ({
  curator: one(users, { fields: [collections.curatedBy], references: [users.id] }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, { fields: [referrals.referrerId], references: [users.id], relationName: "referrer" }),
  referredUser: one(users, { fields: [referrals.referredUserId], references: [users.id] }),
}));

export const applicationDraftsRelations = relations(applicationDrafts, ({ one }) => ({
  writer: one(users, { fields: [applicationDrafts.writerId], references: [users.id] }),
  university: one(universities, { fields: [applicationDrafts.universityId], references: [universities.id] }),
}));

export const collegeApplicationsRelations = relations(collegeApplications, ({ one, many }) => ({
  writer: one(users, { fields: [collegeApplications.writerId], references: [users.id] }),
  university: one(universities, { fields: [collegeApplications.universityId], references: [universities.id] }),
  purchases: many(purchases),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Essay = typeof essays.$inferSelect;
export type University = typeof universities.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type WriterEarnings = typeof writerEarnings.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Rating = typeof ratings.$inferSelect;
export type Collection = typeof collections.$inferSelect;
export type ApplicationDraft = typeof applicationDrafts.$inferSelect;
export type CollegeApplication = typeof collegeApplications.$inferSelect;
