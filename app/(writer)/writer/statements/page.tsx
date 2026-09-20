import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { currentMonthKey } from "@/lib/ledger/statements";
import { PageHead } from "@/components/writer/Manuscript";
import { StatementView } from "@/components/writer/StatementView";

export const metadata: Metadata = { title: "Statements" };

export const dynamic = "force-dynamic";

export default async function WriterStatementsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  return (
    <div className="anim-in mx-auto max-w-[980px] px-11 pb-[70px] pt-10">
      <PageHead eyebrow="Earnings" title="Statements" />
      <p
        className="-mt-4 mb-6 max-w-[62ch] text-[13.5px]"
        style={{ color: "var(--ink-soft)" }}
      >
        Every movement in your balance, month by month — sales, refunds and
        payouts, with a running balance you can hand to an accountant. Sales
        clear after seven days, which is how long a buyer has to raise a
        dispute.
      </p>

      <StatementView initialMonth={currentMonthKey()} />
    </div>
  );
}
