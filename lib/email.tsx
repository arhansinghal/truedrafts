/**
 * TrueDrafts Email Service
 * Single entrypoint for all transactional emails.
 * Uses Resend + React Email templates + DB logging.
 */
import { render } from "@react-email/render";
import { Resend } from "resend";
import { db, users, collegeApplications, writerEarnings } from "./db";
import { emailLogs, bundlePurchases, bundles } from "./db/schema";
import { eq, and, gte, count, inArray, sql } from "drizzle-orm";
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

const FROM = "TrueDrafts <team@truedrafts.com>";
const APP_URL = process.env.NEXT_PUBLIC_URL ?? "https://truedrafts.com";

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes("xxx")) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

// ---------------------------------------------------------------------------
// Internal: atomic rate-limit reservation
// ---------------------------------------------------------------------------

/**
 * Advisory-lock class id for email rate limiting. Advisory locks live in one
 * namespace per database, so the (classid, objid) pair keeps these locks from
 * colliding with anything else that might take an advisory lock later.
 */
const EMAIL_LOCK_CLASS = 0x54445f45; // "TD_E"

/** FNV-1a 32-bit, narrowed to the signed int4 pg_advisory_xact_lock() expects. */
function lockId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  }
  return h | 0;
}

/**
 * Atomically claim one send slot for (type, recipient) inside `windowMs`.
 * Returns the id of the reserved email_logs row, or null when the cap is hit.
 *
 * WHY A TRANSACTION + LOCK, AND NOT JUST A COUNT
 *
 * Counting the window and *then* writing the log row after the provider call
 * is check-then-act. Two password-reset requests for the same address can both
 * read count = 2, both pass the `< 3` test, and both send — 4 emails against a
 * documented maximum of 3. `await` only orders steps *inside* one invocation;
 * it creates no ordering *between* invocations. An in-process mutex would not
 * close it either: on Vercel the two requests routinely land in different
 * lambda instances, so the only shared serialization point is Postgres.
 *
 * So the count and the insert move into a single transaction guarded by a
 * transaction-scoped advisory lock keyed on (type, recipient). Postgres holds
 * that lock across every connection, process and instance, so the second
 * transaction *blocks* until the first has COMMITTED its row — and then counts
 * 3, not 2. And because the row is written before anything is handed to
 * Resend, a slow or failing provider call can no longer widen the window:
 * there is no longer a window between the check and the record at all.
 *
 * pg_advisory_xact_lock (rather than pg_advisory_lock) is deliberate: it is
 * released by COMMIT/ROLLBACK, so it is safe behind a transaction-mode pooler
 * and cannot leak onto a pooled connection if a request dies mid-flight.
 */
async function reserveEmailSlot(opts: {
  to: string;
  subject: string;
  type: string;
  maxCount: number;
  windowMs: number;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const since = new Date(Date.now() - opts.windowMs);
  const objId = lockId(`${opts.type}:${opts.to.trim().toLowerCase()}`);

  return db.transaction(async (tx) => {
    // Serializes concurrent reservations for this (type, recipient) — and only
    // for this pair, so unrelated addresses never queue up behind each other.
    await tx.execute(
      sql`select pg_advisory_xact_lock(${EMAIL_LOCK_CLASS}::int4, ${objId}::int4)`,
    );

    const rows = await tx
      .select({ n: count() })
      .from(emailLogs)
      .where(and(
        eq(emailLogs.recipientEmail, opts.to),
        eq(emailLogs.type, opts.type),
        gte(emailLogs.sentAt, since),
      ));
    if ((rows[0]?.n ?? 0) >= opts.maxCount) return null;

    const inserted = await tx
      .insert(emailLogs)
      .values({
        recipientEmail: opts.to,
        subject: opts.subject,
        type: opts.type,
        // "pending" until dispatch finalises it. The attempt is recorded up
        // front so it counts against the window even if the provider call is
        // slow, fails, or the process dies mid-send — failing closed is the
        // right side to err on for a security rate limit.
        status: "pending",
        metadata: JSON.stringify(opts.metadata ?? {}),
      })
      .returning({ id: emailLogs.id });

    return inserted[0]?.id ?? null;
  });
}

// ---------------------------------------------------------------------------
// Internal: log + send
// ---------------------------------------------------------------------------

/** Write the final outcome: update the reserved row, or insert a fresh one. */
async function recordOutcome(
  opts: { to: string; subject: string; type: string; metadata?: Record<string, unknown> },
  logId: string | null,
  resendId: string | undefined,
  error: string | undefined,
) {
  const status = error ? "failed" : "sent";
  if (logId) {
    await db
      .update(emailLogs)
      .set({ status, resendId, error })
      .where(eq(emailLogs.id, logId))
      .catch(console.error);
    return;
  }
  await db.insert(emailLogs).values({
    recipientEmail: opts.to,
    subject: opts.subject,
    type: opts.type,
    status,
    resendId,
    metadata: JSON.stringify(opts.metadata ?? {}),
    error,
  }).catch(console.error);
}

/**
 * Renders, sends and logs one email. Pass `rateLimit` to cap sends per
 * recipient per window; the cap is enforced by reserving the log row *before*
 * the send (see reserveEmailSlot), so callers cannot reintroduce the
 * count-then-send race by wiring the check up themselves.
 *
 * Returns false when the send was suppressed by the rate limit or failed.
 */
async function dispatch(opts: {
  to: string;
  subject: string;
  type: string;
  element: React.ReactElement;
  metadata?: Record<string, unknown>;
  rateLimit?: { maxCount: number; windowMs: number };
}): Promise<boolean> {
  let logId: string | null = null;
  if (opts.rateLimit) {
    logId = await reserveEmailSlot({
      to: opts.to,
      subject: opts.subject,
      type: opts.type,
      metadata: opts.metadata,
      maxCount: opts.rateLimit.maxCount,
      windowMs: opts.rateLimit.windowMs,
    });
    if (!logId) {
      console.log(`[email] rate limited ${opts.type} for ${opts.to}`);
      return false;
    }
  }

  let resendId: string | undefined;
  let error: string | undefined;
  try {
    const html = await render(opts.element);
    const resend = getResend();

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
  } catch (e) {
    // Rendering (or anything else after the slot was reserved) blew up. Mark
    // the reserved row failed rather than leaving it "pending" forever, then
    // let the error propagate as it did before.
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await recordOutcome(opts, logId, resendId, error);
  }

  return !error;
}

// ---------------------------------------------------------------------------
// 1. FORGOT PASSWORD
// ---------------------------------------------------------------------------
export async function sendForgotPasswordEmail(email: string, name: string, resetUrl: string) {
  // Max 3 attempts per 15 min per email (security: silent fail). The cap is
  // reserved atomically before the send — see reserveEmailSlot — so concurrent
  // requests for the same address cannot both slip past a stale count.
  await dispatch({
    to: email,
    subject: "Reset your TrueDrafts password",
    type: "forgot_password",
    element: <ForgotPasswordEmail name={name} resetUrl={resetUrl} />,
    metadata: { email },
    rateLimit: { maxCount: 3, windowMs: 15 * 60 * 1000 },
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
  // Same race as forgot_password, and worse: with a cap of 1, two overlapping
  // create-hooks both counted 0 and both sent. Reserved atomically now.
  const ctaUrl = role === "writer" ? `${APP_URL}/writer/essays/new` : `${APP_URL}/applications`;
  await dispatch({
    to: email,
    subject: "Welcome to TrueDrafts",
    type: "welcome",
    element: <WelcomeEmail name={name} role={role} ctaUrl={ctaUrl} />,
    metadata: { email, role },
    rateLimit: { maxCount: 1, windowMs: 365 * 24 * 60 * 60 * 1000 },
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
