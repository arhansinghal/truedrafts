import { Resend } from "resend";
import { db, essays, users } from "./db";
import { eq } from "drizzle-orm";

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = "TrueDrafts <noreply@truedrafts.com>";

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #f0f5ff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrap { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,0.06); }
    .header { background: #2563eb; padding: 24px 32px; }
    .header-logo { color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .body { padding: 32px; }
    .title { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 16px; }
    .text { font-size: 15px; color: #4b5563; line-height: 1.65; margin: 0 0 16px; }
    .highlight { background: #eff6ff; border-left: 3px solid #2563eb; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 20px 0; }
    .highlight p { margin: 0; font-size: 14px; color: #1e40af; font-weight: 500; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; font-size: 14px; font-weight: 600; padding: 13px 28px; border-radius: 10px; text-decoration: none; margin-top: 8px; }
    .footer { padding: 20px 32px; border-top: 1px solid #f3f4f6; text-align: center; }
    .footer p { font-size: 12px; color: #9ca3af; margin: 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="header-logo">TrueDrafts</div>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>TrueDrafts &middot; Real essays from real admits &middot; <a href="https://truedrafts.com">truedrafts.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendPurchaseConfirmation(buyerId: string, essayId: string) {
  const resend = getResend();
  if (!resend) return;
  const [buyer, essay] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, buyerId) }),
    db.query.essays.findFirst({ where: eq(essays.id, essayId) }),
  ]);
  if (!buyer || !essay) return;

  const writer = await db.query.users.findFirst({ where: eq(users.id, essay.writerId) });

  await resend!.emails.send({
    from: FROM,
    to: buyer.email,
    subject: `You unlocked: ${essay.title}`,
    html: emailWrapper(`
      <p class="title">You've unlocked an essay! 🎓</p>
      <p class="text">Hi ${buyer.name},</p>
      <p class="text">You now have full access to <strong>${essay.title}</strong>. Head to your library to read it any time.</p>
      <div class="highlight">
        <p>Writer contact: <a href="mailto:${writer?.email}">${writer?.email ?? "N/A"}</a></p>
      </div>
      <p class="text">Feel free to reach out to the writer directly if you have questions about their application experience.</p>
      <a href="${process.env.NEXT_PUBLIC_URL}/essays/${essay.slug}" class="btn">Read Your Essay →</a>
    `),
  });
}

export async function sendWriterSaleNotification(writerId: string, buyerId: string, essayId: string) {
  const resend = getResend();
  if (!resend) return;
  const [writer, buyer, essay] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, writerId) }),
    db.query.users.findFirst({ where: eq(users.id, buyerId) }),
    db.query.essays.findFirst({ where: eq(essays.id, essayId) }),
  ]);
  if (!writer || !buyer || !essay) return;

  const payoutDollars = ((essay.priceCents ?? 0) * 0.8 / 100).toFixed(2);

  await resend!.emails.send({
    from: FROM,
    to: writer.email,
    subject: `Your essay was purchased — +$${payoutDollars} earned`,
    html: emailWrapper(`
      <p class="title">Your essay was just purchased! 💰</p>
      <p class="text">Hi ${writer.name},</p>
      <p class="text"><strong>${essay.title}</strong> was purchased by ${buyer.name}.</p>
      <div class="highlight">
        <p>+$${payoutDollars} added to your available balance</p>
      </div>
      <p class="text">The buyer's contact is <a href="mailto:${buyer.email}">${buyer.email}</a> — they may reach out with questions about your experience.</p>
      <a href="${process.env.NEXT_PUBLIC_URL}/writer/revenue" class="btn">View Your Earnings →</a>
    `),
  });
}

export async function sendEssayApproved(writerId: string, essayId: string) {
  const resend = getResend();
  if (!resend) return;
  const [writer, essay] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, writerId) }),
    db.query.essays.findFirst({ where: eq(essays.id, essayId) }),
  ]);
  if (!writer || !essay) return;

  await resend.emails.send({
    from: FROM,
    to: writer.email,
    subject: `Your essay is live on TrueDrafts`,
    html: emailWrapper(`
      <p class="title">Your essay is live! ✅</p>
      <p class="text">Hi ${writer.name},</p>
      <p class="text"><strong>${essay.title}</strong> has been approved and is now visible to students browsing your university on TrueDrafts.</p>
      <p class="text">Share your essay link to drive more traffic and increase your earnings.</p>
      <a href="${process.env.NEXT_PUBLIC_URL}/essays/${essay.slug}" class="btn">View Your Essay →</a>
    `),
  });
}

export async function sendEssayRejected(writerId: string, essayId: string, reason: string) {
  const resend = getResend();
  if (!resend) return;
  const [writer, essay] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, writerId) }),
    db.query.essays.findFirst({ where: eq(essays.id, essayId) }),
  ]);
  if (!writer || !essay) return;

  await resend.emails.send({
    from: FROM,
    to: writer.email,
    subject: `Action needed: ${essay.title}`,
    html: emailWrapper(`
      <p class="title">Action needed on your submission</p>
      <p class="text">Hi ${writer.name},</p>
      <p class="text">Your essay <strong>${essay.title}</strong> was not approved for the following reason:</p>
      <div class="highlight">
        <p>${reason}</p>
      </div>
      <p class="text">Please revise and resubmit from your writer dashboard. Our team reviews all submissions carefully.</p>
      <a href="${process.env.NEXT_PUBLIC_URL}/writer/essays" class="btn">Go to Dashboard →</a>
    `),
  });
}
