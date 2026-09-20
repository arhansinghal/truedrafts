/**
 * TrueDrafts Email Service
 * Single entrypoint for all transactional emails.
 * Uses Resend + React Email templates + DB logging.
 */
import { render } from "@react-email/render";
import { Resend } from "resend";
import { db, users, collegeApplications, writerEarnings } from "./db";
import { emailLogs, bundlePurchases, bundles } from "./db/schema";
import { eq, and, gte, count, inArray } from "drizzle-orm";
import { formatCents } from "./utils";

import ForgotPasswordEmail from "@/emails/ForgotPassword";
import VerifyEmailEmail from "@/emails/VerifyEmail";
import PurchaseBuyerEmail from "@/emails/PurchaseBuyer";
import PurchaseSellerEmail from "@/emails/PurchaseSeller";
import ApplicationApprovedEmail from "@/emails/ApplicationApproved";
import ApplicationRejectedEmail from "@/emails/ApplicationRejected";
import ApplicationSubmittedEmail from "@/emails/ApplicationSubmitted";
import WelcomeEmail from "@/emails/Welcome";
import PurchaseBundleBuyerEmail from "@/emails/PurchaseBundleBuyer";
import PurchaseBundleSellerEmail from "@/emails/PurchaseBundleSeller";
import SavedSearchDigestEmail from "@/emails/SavedSearchDigest";

const FROM = "TrueDrafts <team@truedrafts.com>";
const APP_URL = process.env.NEXT_PUBLIC_URL ?? "https://truedrafts.com";

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes("xxx")) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

// ---------------------------------------------------------------------------
// Internal: log + send
// ---------------------------------------------------------------------------
async function dispatch(opts: {
  to: string;
  subject: string;
  type: string;
  element: React.ReactElement;
  metadata?: Record<string, unknown>;
}) {
  const html = await render(opts.element);
  const resend = getResend();
  let resendId: string | undefined;
  let error: string | undefined;

  if (resend) {
    try {
      const result = await resend.emails.send({
        from: FROM,
        to: opts.to,
        subject: opts.subject,
        html,
      });
      resendId = result.data?.id ?? undefined;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.error(`[email] send failed (${opts.type}):`, error);
    }
  } else {
    console.log(`[email] no Resend key — skipping send (${opts.type}) to ${opts.to}`);
  }

  await db.insert(emailLogs).values({
    recipientEmail: opts.to,
    subject: opts.subject,
    type: opts.type,
    status: error ? "failed" : "sent",
    resendId,
    metadata: JSON.stringify(opts.metadata ?? {}),
    error,
  }).catch(console.error);
}

// ---------------------------------------------------------------------------
// Internal: rate limit check (returns true if blocked)
// ---------------------------------------------------------------------------
async function isRateLimited(email: string, type: string, maxCount: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const rows = await db
    .select({ n: count() })
    .from(emailLogs)
    .where(and(
      eq(emailLogs.recipientEmail, email),
      eq(emailLogs.type, type),
      gte(emailLogs.sentAt, since),
    ));
  return (rows[0]?.n ?? 0) >= maxCount;
}

// ---------------------------------------------------------------------------
// 1. FORGOT PASSWORD
// ---------------------------------------------------------------------------
export async function sendForgotPasswordEmail(email: string, name: string, resetUrl: string) {
  // Max 3 attempts per 15 min per email (security: silent fail)
  if (await isRateLimited(email, "forgot_password", 3, 15 * 60 * 1000)) {
    console.log(`[email] rate limited forgot_password for ${email}`);
    return;
  }
  await dispatch({
    to: email,
    subject: "Reset your TrueDrafts password",
    type: "forgot_password",
    element: <ForgotPasswordEmail name={name} resetUrl={resetUrl} />,
    metadata: { email },
  });
}

// ---------------------------------------------------------------------------
// 2. EMAIL VERIFICATION
// ---------------------------------------------------------------------------
export async function sendVerifyEmail(email: string, name: string, verifyUrl: string) {
  await dispatch({
    to: email,
    subject: "Verify your TrueDrafts email",
    type: "verify_email",
    element: <VerifyEmailEmail name={name} verifyUrl={verifyUrl} />,
    metadata: { email },
  });
}

// ---------------------------------------------------------------------------
// 2b. WELCOME — sent once when an account is created
// ---------------------------------------------------------------------------
export async function sendWelcomeEmail(email: string, name: string, role?: string | null) {
  // Guard against duplicates (e.g. provider retries) — one welcome per address.
  if (await isRateLimited(email, "welcome", 1, 365 * 24 * 60 * 60 * 1000)) {
    return;
  }
  const ctaUrl = role === "writer" ? `${APP_URL}/writer/essays/new` : `${APP_URL}/applications`;
  await dispatch({
    to: email,
    subject: "Welcome to TrueDrafts",
    type: "welcome",
    element: <WelcomeEmail name={name} role={role} ctaUrl={ctaUrl} />,
    metadata: { email, role },
  });
}

// ---------------------------------------------------------------------------
// 3. PURCHASE CONFIRMATION — Buyer
// ---------------------------------------------------------------------------
export async function sendPurchaseBuyerEmail(buyerId: string, applicationId: string) {
  const [buyer, app] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, buyerId) }),
    db.query.collegeApplications.findFirst({
      where: eq(collegeApplications.id, applicationId),
      with: { university: true, writer: { columns: { id: true, email: true } } },
    }),
  ]);
  if (!buyer || !app) return;

  await dispatch({
    to: buyer.email,
    subject: `You unlocked: ${app.title}`,
    type: "purchase_buyer",
    element: (
      <PurchaseBuyerEmail
        buyerName={buyer.name}
        appTitle={app.title}
        university={app.university.name}
        priceLabel={formatCents(app.priceCents)}
        viewUrl={`${APP_URL}/applications/${app.slug}`}
        writerEmail={app.writer?.email}
      />
    ),
    metadata: { buyerId, applicationId },
  });
}

// ---------------------------------------------------------------------------
// 4. PAYMENT RECEIVED — Seller
// ---------------------------------------------------------------------------
export async function sendPurchaseSellerEmail(writerId: string, applicationId: string) {
  const [writer, app, earnings] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, writerId) }),
    db.query.collegeApplications.findFirst({ where: eq(collegeApplications.id, applicationId) }),
    db.query.writerEarnings.findFirst({ where: eq(writerEarnings.writerId, writerId) }),
  ]);
  if (!writer || !app) return;

  const earnedCents = Math.floor(app.priceCents * 0.5);
  const totalEarnedCents = earnings?.totalEarnedCents ?? earnedCents;

  await dispatch({
    to: writer.email,
    subject: `+${formatCents(earnedCents)} earned — ${app.title} was purchased`,
    type: "purchase_seller",
    element: (
      <PurchaseSellerEmail
        writerName={writer.name}
        appTitle={app.title}
        earnedLabel={formatCents(earnedCents)}
        totalEarnedLabel={formatCents(totalEarnedCents)}
        payoutMinLabel={formatCents(100000)}
        earningsUrl={`${APP_URL}/writer/payout`}
      />
    ),
    metadata: { writerId, applicationId },
  });
}

// ---------------------------------------------------------------------------
// 4b. APPLICATION SUBMITTED — confirmation that we received it
// ---------------------------------------------------------------------------
export async function sendApplicationSubmittedEmail(writerId: string, applicationId: string) {
  const [writer, app] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, writerId), columns: { name: true, email: true } }),
    db.query.collegeApplications.findFirst({
      where: eq(collegeApplications.id, applicationId),
      columns: { title: true, submittedCommonApp: true, numSupplementals: true },
      with: { university: { columns: { name: true } } },
    }),
  ]);
  if (!writer || !app) return;

  const essayCount = (app.submittedCommonApp ? 1 : 0) + (app.numSupplementals ?? 0);

  await dispatch({
    to: writer.email,
    subject: "We've received your application",
    type: "app_submitted",
    element: (
      <ApplicationSubmittedEmail
        writerName={writer.name}
        appTitle={app.title}
        university={app.university.name}
        essayCount={essayCount}
        dashboardUrl={`${APP_URL}/writer`}
      />
    ),
    metadata: { writerId, applicationId },
  });
}

// ---------------------------------------------------------------------------
// 5. APPLICATION APPROVED
// ---------------------------------------------------------------------------
export async function sendApplicationApprovedEmail(writerId: string, applicationId: string, highlight?: string | null) {
  const [writer, app] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, writerId) }),
    db.query.collegeApplications.findFirst({
      where: eq(collegeApplications.id, applicationId),
      with: { university: true },
    }),
  ]);
  if (!writer || !app) return;

  await dispatch({
    to: writer.email,
    subject: `Your application is live on TrueDrafts`,
    type: "app_approved",
    element: (
      <ApplicationApprovedEmail
        writerName={writer.name}
        appTitle={app.title}
        university={app.university.name}
        priceLabel={formatCents(app.priceCents)}
        viewUrl={`${APP_URL}/applications/${app.slug}`}
        highlight={highlight}
      />
    ),
    metadata: { writerId, applicationId },
  });
}

// ---------------------------------------------------------------------------
// 7. BUNDLE PURCHASE — Buyer
// ---------------------------------------------------------------------------
export async function sendPurchaseBundleBuyerEmail(bundlePurchaseId: string) {
  const bp = await db.query.bundlePurchases.findFirst({
    where: eq(bundlePurchases.id, bundlePurchaseId),
  });
  if (!bp) return;

  const [buyer, bundle] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, bp.buyerId) }),
    db.query.bundles.findFirst({ where: eq(bundles.id, bp.bundleId) }),
  ]);
  if (!buyer || !bundle) return;

  const apps = await db.query.collegeApplications.findMany({
    where: inArray(collegeApplications.id, bp.applicationIdsSnapshot),
    with: { university: { columns: { name: true } } },
  });

  const members = apps.map((a) => ({
    title: a.title,
    university: a.university.name,
    url: `${APP_URL}/applications/${a.slug}`,
  }));

  const sumPrices = (() => {
    try {
      const snap = JSON.parse(bp.priceSnapshot) as Array<{ priceCents: number }>;
      return snap.reduce((acc, x) => acc + (x.priceCents ?? 0), 0);
    } catch { return bp.totalCents; }
  })();
  const savingsCents = Math.max(0, sumPrices - bp.totalCents);

  await dispatch({
    to: buyer.email,
    subject: `You unlocked: ${bundle.title}`,
    type: "purchase_bundle_buyer",
    element: (
      <PurchaseBundleBuyerEmail
        buyerName={buyer.name}
        bundleTitle={bundle.title}
        totalLabel={formatCents(bp.totalCents)}
        savingsLabel={formatCents(savingsCents)}
        members={members}
        libraryUrl={`${APP_URL}/library`}
      />
    ),
    metadata: { buyerId: bp.buyerId, bundlePurchaseId, bundleId: bp.bundleId },
  });
}

// ---------------------------------------------------------------------------
// 8. BUNDLE PURCHASE — Seller (one per writer per app)
// ---------------------------------------------------------------------------
export async function sendPurchaseBundleSellerEmail(
  writerId: string,
  bundlePurchaseId: string,
  applicationId: string,
  earnedCents: number,
) {
  const [writer, app, bp, earnings] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, writerId) }),
    db.query.collegeApplications.findFirst({ where: eq(collegeApplications.id, applicationId) }),
    db.query.bundlePurchases.findFirst({ where: eq(bundlePurchases.id, bundlePurchaseId) }),
    db.query.writerEarnings.findFirst({ where: eq(writerEarnings.writerId, writerId) }),
  ]);
  if (!writer || !app || !bp) return;

  const bundle = await db.query.bundles.findFirst({ where: eq(bundles.id, bp.bundleId) });
  if (!bundle) return;

  const totalEarnedCents = earnings?.totalEarnedCents ?? earnedCents;

  await dispatch({
    to: writer.email,
    subject: `+${formatCents(earnedCents)} earned — bundle sale of ${app.title}`,
    type: "purchase_bundle_seller",
    element: (
      <PurchaseBundleSellerEmail
        writerName={writer.name}
        appTitle={app.title}
        bundleTitle={bundle.title}
        earnedLabel={formatCents(earnedCents)}
        totalEarnedLabel={formatCents(totalEarnedCents)}
        earningsUrl={`${APP_URL}/writer/payout`}
      />
    ),
    metadata: { writerId, applicationId, bundlePurchaseId, earnedCents },
  });
}

// ---------------------------------------------------------------------------
// 6. APPLICATION REJECTED
// ---------------------------------------------------------------------------
export async function sendApplicationRejectedEmail(writerId: string, applicationId: string, reason: string) {
  const [writer, app] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, writerId) }),
    db.query.collegeApplications.findFirst({ where: eq(collegeApplications.id, applicationId) }),
  ]);
  if (!writer || !app) return;

  await dispatch({
    to: writer.email,
    subject: `Action needed: ${app.title} wasn't approved`,
    type: "app_rejected",
    element: (
      <ApplicationRejectedEmail
        writerName={writer.name}
        appTitle={app.title}
        reason={reason}
        editUrl={`${APP_URL}/writer/essays`}
      />
    ),
    metadata: { writerId, applicationId, reason },
  });
}

// ---------------------------------------------------------------------------
// 7. SAVED SEARCH DIGEST
// ---------------------------------------------------------------------------
export async function sendSavedSearchDigestEmail(payload: {
  userId: string;
  email: string;
  name: string;
  totalMatches: number;
  sections: {
    name: string;
    description: string;
    href: string;
    matches: {
      slug: string;
      title: string;
      universityName: string;
      admittedYear: number | null;
      priceCents: number;
    }[];
  }[];
}) {
  if (payload.sections.length === 0) return;

  // At most one digest per reader per day, whatever the cadence says. Cheap
  // insurance against a cron misfire turning into an inbox full of duplicates.
  if (
    await isRateLimited(
      payload.email,
      "saved_search_digest",
      1,
      20 * 60 * 60 * 1000,
    )
  ) {
    console.log(`[email] digest rate-limited for ${payload.email}`);
    return;
  }

  const noun = payload.totalMatches === 1 ? "application" : "applications";

  await dispatch({
    to: payload.email,
    subject: `${payload.totalMatches} new ${noun} matching your saved searches`,
    type: "saved_search_digest",
    element: (
      <SavedSearchDigestEmail
        name={payload.name}
        totalMatches={payload.totalMatches}
        appUrl={APP_URL}
        manageUrl={`${APP_URL}/dashboard/saved-searches`}
        sections={payload.sections.map((section) => ({
          name: section.name,
          description: section.description,
          href: section.href,
          matches: section.matches.map((m) => ({
            slug: m.slug,
            title: m.title,
            universityName: m.universityName,
            admittedYear: m.admittedYear,
            priceLabel: formatCents(m.priceCents),
          })),
        }))}
      />
    ),
    metadata: {
      userId: payload.userId,
      totalMatches: payload.totalMatches,
      searches: payload.sections.length,
    },
  });
}
