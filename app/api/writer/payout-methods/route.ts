import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writerPayoutMethods } from "@/lib/db/schema";
import { isTrustedOrigin } from "@/lib/csrf";
import {
  validatePayoutMethodInput,
  maskPayoutMethodForWriter,
} from "@/lib/payout-methods";
import { encryptPayoutField } from "@/lib/payout-encryption";
import { eq } from "drizzle-orm";

// List all payout methods belonging to the signed-in writer. Sensitive
// fields are masked before returning.
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.query.writerPayoutMethods.findMany({
    where: eq(writerPayoutMethods.writerId, session.user.id),
    orderBy: (m, { desc }) => [desc(m.isDefault), desc(m.updatedAt)],
  });
  return Response.json(rows.map(maskPayoutMethodForWriter));
}

// Create a new payout method. If it's the writer's FIRST method, it's auto-
// marked as default. Caller may pass `isDefault: true` to take over the
// default slot from any existing methods.
export async function POST(req: Request) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const v = validatePayoutMethodInput(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

  const wantsDefault =
    typeof body === "object" && body !== null && (body as { isDefault?: unknown }).isDefault === true;

  // Build the row values per kind. Bank account number is encrypted; the
  // last 4 digits are kept plaintext for display.
  type InsertValues = typeof writerPayoutMethods.$inferInsert;
  const base: InsertValues = {
    writerId: session.user.id,
    kind: v.value.kind,
    isDefault: false, // set below in a tx so exactly one default per writer
    accountHolderName: v.value.accountHolderName,
  };
  if (v.value.kind === "upi") {
    base.upiId = v.value.upiId;
  } else if (v.value.kind === "bank_account") {
    base.bankAccountNumberEncrypted = encryptPayoutField(
      v.value.bankAccountNumber,
    );
    base.bankAccountNumberLast4 = v.value.bankAccountNumber.slice(-4);
    base.bankIfsc = v.value.bankIfsc;
  } else if (v.value.kind === "zelle") {
    if (v.value.zelleEmail) base.zelleEmail = v.value.zelleEmail;
    if (v.value.zellePhone) base.zellePhone = v.value.zellePhone;
  }

  const created = await db.transaction(async (tx) => {
    const existing = await tx.query.writerPayoutMethods.findMany({
      where: eq(writerPayoutMethods.writerId, session.user.id),
    });
    const becomeDefault = existing.length === 0 || wantsDefault;

    if (becomeDefault && existing.length > 0) {
      await tx
        .update(writerPayoutMethods)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(writerPayoutMethods.writerId, session.user.id));
    }

    const [row] = await tx
      .insert(writerPayoutMethods)
      .values({ ...base, isDefault: becomeDefault })
      .returning();
    return row;
  });

  return Response.json(maskPayoutMethodForWriter(created), { status: 201 });
}
