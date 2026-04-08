/**
 * TrueDrafts Email Service
 * Single entrypoint for all transactional emails.
 * Uses Resend + React Email templates + DB logging.
 */
import { render } from "@react-email/render";
import { Resend } from "resend";
import { db, users, collegeApplications, writerEarnings } from "./db";
import { emailLogs } from "./db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import { formatCents } from "./utils";

import ForgotPasswordEmail from "@/emails/ForgotPassword";
import VerifyEmailEmail from "@/emails/VerifyEmail";
import PurchaseBuyerEmail from "@/emails/PurchaseBuyer";
import PurchaseSellerEmail from "@/emails/PurchaseSeller";
import ApplicationApprovedEmail from "@/emails/ApplicationApproved";
import ApplicationRejectedEmail from "@/emails/ApplicationRejected";

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
        priceDollars={(app.priceCents / 100).toFixed(2)}
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
        earnedDollars={(earnedCents / 100).toFixed(2)}
        totalEarnedDollars={(totalEarnedCents / 100).toFixed(2)}
        earningsUrl={`${APP_URL}/writer/revenue`}
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
        priceDollars={(app.priceCents / 100).toFixed(2)}
        viewUrl={`${APP_URL}/applications/${app.slug}`}
        highlight={highlight}
      />
    ),
    metadata: { writerId, applicationId },
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
