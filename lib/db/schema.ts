import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  vector,
  index,
  primaryKey,
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
export const payoutMethodKindEnum = pgEnum("payout_method_kind", [
  "upi",
  "bank_account",
  "zelle",
]);
export const essayTypeEnum = pgEnum("essay_type", [
  "common_app",
  "supplemental",
  "why_school",
  "activities",
  "short_answer",
  "other",
]);
export const bundleKindEnum = pgEnum("bundle_kind", ["static", "rule"]);
export const bundlePricingModeEnum = pgEnum("bundle_pricing_mode", [
  "flat",
  "percent",
]);
export const bundleStatusEnum = pgEnum("bundle_status", [
  "draft",
  "published",
  "archived",
]);
export const studioEssayStatusEnum = pgEnum("studio_essay_status", [
  "draft",
  "in_progress",
  "done",
]);
export const studioSourceKindEnum = pgEnum("studio_source_kind", [
  "url",
  "pdf",
]);
export const studioSourceStatusEnum = pgEnum("studio_source_status", [
  "pending",
  "ingesting",
  "ready",
  "failed",
  "paywalled",
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
  verifiedAdmit: boolean("verified_admit").default(false),
  referralCode: text("referral_code").unique(),
  satScore: integer("sat_score"),
  actScore: integer("act_score"),
  gpa: text("gpa"),
  extracurriculars: text("extracurriculars"),
  graduationYear: integer("graduation_year"),
  country: text("country"),
  activities: text("activities").default("[]"), // JSON: [{name, description}]
  // Stamped at submission time once writers have accepted the bundle-inclusion
  // clause in the application upload wizard. NULL for legacy/grandfathered apps.
  writersAgreedBundlesAt: timestamp("writers_agreed_bundles_at"),
  // Set when an admin deletes the account: login is revoked, PII is scrubbed and
  // the user's listings are archived, but purchase/earning/payout records remain
  // so buyers keep access. NULL = active account.
  deletedAt: timestamp("deleted_at"),
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
  // Location & classification (populated by seed script)
  state: text("state"),                   // 2-letter US state abbr, e.g. "MA"
  city: text("city"),                     // e.g. "Cambridge"
  region: text("region"),                 // northeast | south | midwest | west | mid_atlantic
  type: text("type"),                     // ivy | public_flagship | private_research | liberal_arts
  aliases: text("aliases").array().default([]), // searchable nicknames ["penn","wharton",…]
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
  // Razorpay payment_id. UNIQUE — primary idempotency key for single-item
  // purchases. NULL on bundle children (parent's razorpayOrderId is the key).
  razorpayPaymentId: text("razorpay_payment_id").unique(),
  status: purchaseStatusEnum("status").notNull().default("completed"),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  bundlePurchaseId: uuid("bundle_purchase_id"),
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
  // External payout reference (e.g. RazorpayX payout_id if/when wired; manual
  // bank transfer reference otherwise). Free-form text, no uniqueness needed.
  razorpayPayoutId: text("razorpay_payout_id"),
  status: payoutStatusEnum("status").notNull().default("pending"),
  // The payout method snapshot at request time. Method ID is kept for joins;
  // the snapshot JSON encodes the kind + masked details so historical records
  // survive method edits/deletes.
  payoutMethodId: uuid("payout_method_id"),
  payoutMethodSnapshot: text("payout_method_snapshot"),
  requestedAt: timestamp("requested_at").defaultNow(),
  paidAt: timestamp("paid_at"),
});

// Writer payout destinations. Sensitive fields (account number, etc.) are
// AES-256-GCM encrypted with PAYOUT_ENCRYPTION_KEY before storage; only
// last4/IFSC/UPI handle/email are stored in plaintext for masking and display.
//
// One row per (writer, kind) is sufficient for MVP; many writers will only
// have one. `is_default` marks which one the /api/writer/payout flow uses;
// exactly one default per writer is enforced at the API layer, not the DB.
export const writerPayoutMethods = pgTable("writer_payout_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  writerId: text("writer_id")
    .notNull()
    .references(() => users.id),
  kind: payoutMethodKindEnum("kind").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  accountHolderName: text("account_holder_name").notNull(),
  // UPI: VPA stored plaintext (already public-shareable, e.g. user@paytm).
  upiId: text("upi_id"),
  // Bank: full account number encrypted; last4 + IFSC kept plaintext for UX
  // and admin transfer setup.
  bankAccountNumberEncrypted: text("bank_account_number_encrypted"),
  bankAccountNumberLast4: text("bank_account_number_last4"),
  bankIfsc: text("bank_ifsc"),
  // Zelle: routed by email or US phone, neither secret. Both kept plaintext.
  zelleEmail: text("zelle_email"),
  zellePhone: text("zelle_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  rejectionNote: text("rejection_note"),
  createdAt: timestamp("created_at").defaultNow(),
  publishedAt: timestamp("published_at"),
  // Vibe Search
  major: text("major"), // inferred major (searchable), optional
  vibeMetadata: text("vibe_metadata"),   // JSON: {tone, core_values, narrative_arc, vibe_summary, themes, major, activities}
  vibeTone: text("vibe_tone"),           // extracted for SQL filtering
  vibeSearchText: text("vibe_search_text"), // flat string of all AI terms — supports FTS + ILIKE fallback
  // AI Insight Brief — generated once at approval by Python AI service
  insightBrief: text("insight_brief"),   // JSON: {essay_focus, applicant_profile, why_it_worked, tone_signature, standout_quote}
  // Voyage embedding of the insight brief summary. Powers school-scoped style
  // signal for the Writing Studio. Backfilled by scripts/embed-insight-briefs.ts.
  insightBriefEmbedding: vector("insight_brief_embedding", { dimensions: 1024 }),
});

// ─── Bundles ──────────────────────────────────────────────────────────────────
//
// A bundle is a discounted package of college applications. Two flavours:
//   - kind="static": admin hand-picks application IDs; stored in applicationIds.
//   - kind="rule":   admin defines a JSON rule (e.g. {"universityType":"ivy"});
//                    members are resolved at read-time by lib/bundles.ts.
//
// Pricing is stored as either a flat cent value OR a percentage discount off
// the *current* sum of member application prices. The actual price the buyer
// pays is computed at request-time so it stays in sync as underlying prices
// move. The price they paid is snapshotted into bundlePurchases.totalCents.

export const bundles = pgTable("bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  kind: bundleKindEnum("kind").notNull(),
  // Static bundles populate this directly; rule bundles leave it empty and
  // resolve members from ruleConfig.
  applicationIds: uuid("application_ids").array().default([]),
  ruleConfig: text("rule_config"), // JSON: e.g. {"universityType":"ivy","year":2024}
  pricingMode: bundlePricingModeEnum("pricing_mode").notNull(),
  flatPriceCents: integer("flat_price_cents"),     // set when pricingMode="flat"
  discountPercent: integer("discount_percent"),     // 0–100; set when pricingMode="percent"
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  status: bundleStatusEnum("status").notNull().default("draft"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bundlePurchases = pgTable("bundle_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  buyerId: text("buyer_id").notNull().references(() => users.id),
  bundleId: uuid("bundle_id").notNull().references(() => bundles.id),
  totalCents: integer("total_cents").notNull(),
  platformFeeCents: integer("platform_fee_cents").notNull(),
  writerPayoutTotalCents: integer("writer_payout_total_cents").notNull(),
  // Snapshot of which apps were in the bundle at purchase time, plus their
  // individual prices. Survives later edits / unpublishes so the buyer keeps
  // exactly what they paid for.
  applicationIdsSnapshot: uuid("application_ids_snapshot").array().notNull(),
  priceSnapshot: text("price_snapshot").notNull(), // JSON: [{applicationId, priceCents}]
  // Razorpay order_id. UNIQUE — primary idempotency key. Both the verify-payment
  // route and the webhook upsert on this; whichever fires first wins.
  razorpayOrderId: text("razorpay_order_id").notNull().unique(),
  status: purchaseStatusEnum("status").notNull().default("completed"),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});

// Razorpay order metadata (`notes`) is capped at 15 keys × 256 chars — too small
// for a real bundle's app list + per-app prices. We snapshot the full payload
// here at order-create time and the verify / webhook handlers read it back
// keyed by razorpayOrderId.
export const pendingBundleCheckouts = pgTable("pending_bundle_checkouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  razorpayOrderId: text("razorpay_order_id").notNull().unique(),
  bundleId: uuid("bundle_id").notNull().references(() => bundles.id),
  buyerId: text("buyer_id").notNull().references(() => users.id),
  totalCents: integer("total_cents").notNull(),
  applicationIdsSnapshot: uuid("application_ids_snapshot").array().notNull(),
  priceSnapshot: text("price_snapshot").notNull(), // JSON: [{applicationId, priceCents}]
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  bundlePurchase: one(bundlePurchases, { fields: [purchases.bundlePurchaseId!], references: [bundlePurchases.id] }),
}));

export const bundlesRelations = relations(bundles, ({ one, many }) => ({
  creator: one(users, { fields: [bundles.createdBy!], references: [users.id] }),
  purchases: many(bundlePurchases),
}));

export const bundlePurchasesRelations = relations(bundlePurchases, ({ one, many }) => ({
  buyer: one(users, { fields: [bundlePurchases.buyerId], references: [users.id] }),
  bundle: one(bundles, { fields: [bundlePurchases.bundleId], references: [bundles.id] }),
  childPurchases: many(purchases),
}));

export const pendingBundleCheckoutsRelations = relations(pendingBundleCheckouts, ({ one }) => ({
  bundle: one(bundles, { fields: [pendingBundleCheckouts.bundleId], references: [bundles.id] }),
  buyer: one(users, { fields: [pendingBundleCheckouts.buyerId], references: [users.id] }),
}));

export const writerEarningsRelations = relations(writerEarnings, ({ one }) => ({
  writer: one(users, { fields: [writerEarnings.writerId], references: [users.id] }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  writer: one(users, { fields: [payouts.writerId], references: [users.id] }),
}));

export const writerPayoutMethodsRelations = relations(writerPayoutMethods, ({ one }) => ({
  writer: one(users, { fields: [writerPayoutMethods.writerId], references: [users.id] }),
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

// ─── Writing Studio ───────────────────────────────────────────────────────────
//
// Phase A scope. A studioApp is one workspace bound to one university (per user
// product decision: app = one school for clean library tuning). Each app holds
// N essays — typically Common App + supplementals. Hub sources/chunks come in
// Phase B; suggestions cache comes in Phase C.

export const studioApps = pgTable("studio_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  universityId: uuid("university_id")
    .notNull()
    .references(() => universities.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const studioEssays = pgTable("studio_essays", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: uuid("app_id")
    .notNull()
    .references(() => studioApps.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  prompt: text("prompt"),
  wordCap: integer("word_cap"),
  // Tiptap ProseMirror doc JSON. Keep as text — never queried inside.
  content: text("content")
    .notNull()
    .default('{"type":"doc","content":[{"type":"paragraph"}]}'),
  // Plain-text mirror, refreshed on every save. Powers word count and the
  // sentence-end detector (Phase C reads this server-side too).
  contentText: text("content_text").notNull().default(""),
  wordCount: integer("word_count").notNull().default(0),
  status: studioEssayStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const studioAppsRelations = relations(studioApps, ({ one, many }) => ({
  user: one(users, { fields: [studioApps.userId], references: [users.id] }),
  university: one(universities, {
    fields: [studioApps.universityId],
    references: [universities.id],
  }),
  essays: many(studioEssays),
}));

export const studioEssaysRelations = relations(studioEssays, ({ one }) => ({
  app: one(studioApps, {
    fields: [studioEssays.appId],
    references: [studioApps.id],
  }),
}));

// Knowledge Hub — per-app sources (URLs, PDFs) parsed into chunks with
// embeddings. Retrieved at sentence-end to ground AI suggestions.

export const studioSources = pgTable("studio_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: uuid("app_id")
    .notNull()
    .references(() => studioApps.id, { onDelete: "cascade" }),
  kind: studioSourceKindEnum("kind").notNull(),
  // URL for kind=url, blob storage path / data: URI tag for kind=pdf.
  uri: text("uri").notNull(),
  title: text("title").notNull(),
  status: studioSourceStatusEnum("status").notNull().default("pending"),
  // SHA-256 of extracted text — lets weekly re-fetch skip re-embed when content
  // hasn't changed. NULL until first successful ingestion.
  contentHash: text("content_hash"),
  errorMessage: text("error_message"),
  lastFetchedAt: timestamp("last_fetched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studioSourceChunks = pgTable(
  "studio_source_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => studioSources.id, { onDelete: "cascade" }),
    appId: uuid("app_id")
      .notNull()
      .references(() => studioApps.id, { onDelete: "cascade" }),
    ord: integer("ord").notNull(),
    text: text("text").notNull(),
    tokenCount: integer("token_count").notNull(),
    // voyage-3-lite is 1024-dim. NULL until embedding completes (single tx).
    embedding: vector("embedding", { dimensions: 1024 }),
  },
  (t) => [
    // ivfflat index for cosine similarity. Created at db:push time but only
    // becomes effective once we have ~100+ rows; small datasets use seq scan.
    index("studio_source_chunks_embedding_idx")
      .using("ivfflat", t.embedding.op("vector_cosine_ops"))
      .with({ lists: 50 }),
    index("studio_source_chunks_app_idx").on(t.appId),
  ],
);

// In-memory rate limit replacement: persisted per-user counters keyed by
// (userId, route). Window-bucketed so we just check count vs limit per minute
// / per day. Cheap, durable across deploys, no Upstash needed.
export const studioRateLimits = pgTable(
  "studio_rate_limits",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(),
    windowStart: timestamp("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bucket, t.windowStart] })],
);

export const studioSourcesRelations = relations(studioSources, ({ one, many }) => ({
  app: one(studioApps, { fields: [studioSources.appId], references: [studioApps.id] }),
  chunks: many(studioSourceChunks),
}));

export const studioSourceChunksRelations = relations(studioSourceChunks, ({ one }) => ({
  source: one(studioSources, {
    fields: [studioSourceChunks.sourceId],
    references: [studioSources.id],
  }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Essay = typeof essays.$inferSelect;
export type University = typeof universities.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type WriterEarnings = typeof writerEarnings.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type WriterPayoutMethod = typeof writerPayoutMethods.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Rating = typeof ratings.$inferSelect;
export type Collection = typeof collections.$inferSelect;
export type ApplicationDraft = typeof applicationDrafts.$inferSelect;
export type CollegeApplication = typeof collegeApplications.$inferSelect;
export type Bundle = typeof bundles.$inferSelect;
export type BundlePurchase = typeof bundlePurchases.$inferSelect;
export type PendingBundleCheckout = typeof pendingBundleCheckouts.$inferSelect;
export type StudioApp = typeof studioApps.$inferSelect;
export type StudioEssay = typeof studioEssays.$inferSelect;
export type StudioSource = typeof studioSources.$inferSelect;
export type StudioSourceChunk = typeof studioSourceChunks.$inferSelect;
