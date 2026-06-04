import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  writerEarnings,
  payouts,
  purchases,
  collegeApplications,
  writerPayoutMethods,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { PayoutButton } from "@/components/writer/PayoutButton";
import { PayoutMethodsManager } from "@/components/writer/PayoutMethodsManager";
import { maskPayoutMethodForWriter } from "@/lib/payout-methods";
import { formatCents, timeAgo } from "@/lib/utils";
import { PageHead, StatusPill } from "@/components/writer/Manuscript";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payout" };

export default async function PayoutPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  // Get writer's application IDs for filtering purchases
  const myApps = await db.query.collegeApplications.findMany({
    where: eq(collegeApplications.writerId, session.user.id),
    columns: { id: true, title: true },
  });
  const myAppTitleMap = Object.fromEntries(myApps.map((a) => [a.id, a.title]));

  const [earnings, recentPayouts, recentSales, methodRows] = await Promise.all([
    db.query.writerEarnings.findFirst({ where: eq(writerEarnings.writerId, session.user.id) }),
    db.query.payouts.findMany({
      where: eq(payouts.writerId, session.user.id),
      orderBy: [desc(payouts.requestedAt)],
      limit: 10,
    }),
    db.query.purchases
      .findMany({
        where: eq(purchases.status, "completed"),
        with: {
          essay: { columns: { title: true, writerId: true } },
          application: { columns: { id: true, writerId: true } },
        },
        orderBy: [desc(purchases.purchasedAt)],
        limit: 100,
      })
      .then((rows) =>
        rows
          .filter(
            (r) =>
              r.essay?.writerId === session.user.id ||
              r.application?.writerId === session.user.id,
          )
          .slice(0, 20),
      ),
    db.query.writerPayoutMethods.findMany({
      where: eq(writerPayoutMethods.writerId, session.user.id),
      orderBy: (m, { desc }) => [desc(m.isDefault), desc(m.updatedAt)],
    }),
  ]);

  const availableCents = earnings?.availableCents ?? 0;
  const pendingCents = earnings?.pendingCents ?? 0;
  const totalEarnedCents = earnings?.totalEarnedCents ?? 0;
  const methods = methodRows.map(maskPayoutMethodForWriter);

  return (
    <div className="anim-in mx-auto max-w-[760px] px-11 pb-[70px] pt-10">
      <PageHead eyebrow="Earnings" title="Payout" sub="Your balance, methods, and history" />

      {/* Balance hero */}
      <div
        className="mb-[22px] overflow-hidden rounded-[14px]"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex flex-wrap items-center gap-7 px-[26px] py-6">
          <div className="flex-1">
            <div className="eyebrow">Available to withdraw</div>
            <div
              className="serif my-1.5 text-[40px] font-semibold"
              style={{ color: "var(--ink)", letterSpacing: "-.02em" }}
            >
              {formatCents(availableCents)}
            </div>
            <div className="flex gap-[18px] text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
              <span>
                Pending: <span className="mono" style={{ color: "var(--ink-soft)" }}>{formatCents(pendingCents)}</span>
              </span>
              <span>
                Lifetime: <span className="mono" style={{ color: "var(--ink-soft)" }}>{formatCents(totalEarnedCents)}</span>
              </span>
            </div>
          </div>
          <PayoutButton availableCents={availableCents} initialMethods={methods} />
        </div>
        <div className="h-1" style={{ background: "linear-gradient(90deg, var(--emerald), var(--td-blue))" }} />
      </div>

      {/* Payout Methods */}
      <section id="payout-methods" className="mb-[30px] scroll-mt-20">
        <h2 className="mb-1 text-base font-bold" style={{ color: "var(--ink)" }}>
          Payout methods
        </h2>
        <p className="mb-4 text-sm" style={{ color: "var(--ink-soft)" }}>
          How we send you your earnings. Save multiple methods and pick a default.
          Bank account numbers are encrypted at rest; only the last 4 digits are
          shown after saving.
        </p>
        <PayoutMethodsManager initial={methods} />
      </section>

      {/* Recent Sales */}
      {recentSales.length > 0 && (
        <section className="mb-[30px]">
          <h2 className="mb-3 text-base font-bold" style={{ color: "var(--ink)" }}>
            Recent sales
          </h2>
          <div className="flex flex-col gap-2">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-[10px] px-[15px] py-3"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
              >
                <div>
                  <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                    {sale.essay?.title ??
                      (sale.application?.id ? myAppTitleMap[sale.application.id] : null) ??
                      "Application"}
                  </div>
                  <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
                    {timeAgo(sale.purchasedAt)}
                  </div>
                </div>
                <span className="mono text-[14px] font-semibold" style={{ color: "var(--emerald)" }}>
                  +{formatCents(sale.writerPayoutCents)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Payout History */}
      <section>
        <h2 className="mb-3 text-base font-bold" style={{ color: "var(--ink)" }}>
          Payout history
        </h2>
        {recentPayouts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-faint)" }}>No payouts yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentPayouts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-[10px] px-[15px] py-3"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
              >
                <div>
                  <div className="mono text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
                    {formatCents(p.amountCents)}
                  </div>
                  <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
                    {timeAgo(p.requestedAt)}
                  </div>
                </div>
                <StatusPill status={p.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
