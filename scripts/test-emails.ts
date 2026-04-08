/**
 * Test script — sends all 6 email types to a test address.
 * Usage: npx tsx scripts/test-emails.ts your@email.com
 */
import {
  sendForgotPasswordEmail,
  sendVerifyEmail,
  sendPurchaseBuyerEmail,
  sendPurchaseSellerEmail,
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
} from "../lib/email";
import { db, users, collegeApplications } from "../lib/db";

async function main() {
  const testEmail = process.argv[2];
  if (!testEmail) {
    console.error("Usage: npx tsx scripts/test-emails.ts your@email.com");
    process.exit(1);
  }

  console.log(`Sending all email types to ${testEmail}…\n`);

  // 1. Forgot password
  console.log("1. Forgot Password");
  await sendForgotPasswordEmail(
    testEmail,
    "Test User",
    `${process.env.NEXT_PUBLIC_URL}/reset-password?token=test_token_abc123`
  );

  // 2. Verify email
  console.log("2. Verify Email");
  await sendVerifyEmail(
    testEmail,
    "Test User",
    `${process.env.NEXT_PUBLIC_URL}/verify-email?token=test_verify_xyz789`
  );

  // 3-6. Use real DB records if available
  const firstApp = await db.query.collegeApplications.findFirst({
    where: (t, { eq }) => eq(t.status, "approved"),
    with: { university: true, writer: { columns: { id: true, email: true } } },
  });

  if (firstApp) {
    console.log("3. Purchase Buyer");
    const firstBuyer = await db.query.users.findFirst();
    if (firstBuyer) await sendPurchaseBuyerEmail(firstBuyer.id, firstApp.id);

    console.log("4. Purchase Seller");
    await sendPurchaseSellerEmail(firstApp.writerId, firstApp.id);

    console.log("5. Application Approved");
    await sendApplicationApprovedEmail(
      firstApp.writerId,
      firstApp.id,
      "I realized then that debugging code and debugging myself required the same patient curiosity."
    );

    console.log("6. Application Rejected");
    await sendApplicationRejectedEmail(
      firstApp.writerId,
      firstApp.id,
      "Essay content appears to be placeholder text. Please add your actual written essays before resubmitting."
    );
  } else {
    console.log("3–6. No approved applications found — skipping those tests.");
  }

  console.log("\nDone. Check your inbox and the email_logs table.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
