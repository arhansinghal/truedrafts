import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writerPayoutMethods } from "@/lib/db/schema";
import { isTrustedOrigin } from "@/lib/csrf";
import {
  validatePayoutMethodInput,
  maskPayoutMethodForWriter,
} from "@/lib/payout-methods";
import { encryptPayoutField } from "@/lib/payout-encryption";
import { and, eq, ne } from "drizzle-orm";

// PATCH replaces all editable fields. To change kind, delete and re-create —
// keeping kind switches out of UPDATE keeps the per-kind nullable fields
// from getting tangled.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.query.writerPayoutMethods.findFirst({
    where: and(
      eq(writerPayoutMethods.id, id),
      eq(writerPayoutMethods.writerId, session.user.id),
    ),
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Allow editing the default flag without changing the rest of the row.
  const wantsDefault =
    typeof body === "object" &&
    body !== null &&
    (body as { isDefault?: unknown }).isDefault === true;

  // If the body has a `kind`, treat it as a full update; require all per-kind
  // fields. Otherwise it's a default-only toggle.
  const hasKind =
    typeof body === "object" && body !== null && "kind" in (body as object);

  if (!hasKind) {
    // Default-flag toggle only.
    if (!wantsDefault) {
      return Response.json(
        { error: "Pass isDefault=true to make this the default, or include the full method body to edit details" },
        { status: 400 },
      );
    }
    const updated = await db.transaction(async (tx) => {
      await tx
        .update(writerPayoutMethods)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(writerPayoutMethods.writerId, session.user.id),
            ne(writerPayoutMethods.id, id),
          ),
        );
      const [row] = await tx
        .update(writerPayoutMethods)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(writerPayoutMethods.id, id))
        .returning();
      return row;
    });
    return Response.json(maskPayoutMethodForWriter(updated));
  }

  const v = validatePayoutMethodInput(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

  if (v.value.kind !== existing.kind) {
    return Response.json(
      {
        error:
          "Cannot change kind via PATCH — delete this method and create a new one.",
      },
      { status: 400 },
    );
  }

  // Build the per-kind update set. Clear sibling-kind columns to keep the
  // row consistent.
  type UpdateValues = Partial<typeof writerPayoutMethods.$inferInsert>;
  const updates: UpdateValues = {
    accountHolderName: v.value.accountHolderName,
    updatedAt: new Date(),
  };
  if (v.value.kind === "upi") {
    updates.upiId = v.value.upiId;
  } else if (v.value.kind === "bank_account") {
    updates.bankAccountNumberEncrypted = encryptPayoutField(
      v.value.bankAccountNumber,
    );
    updates.bankAccountNumberLast4 = v.value.bankAccountNumber.slice(-4);
    updates.bankIfsc = v.value.bankIfsc;
  } else if (v.value.kind === "zelle") {
    updates.zelleEmail = v.value.zelleEmail ?? null;
    updates.zellePhone = v.value.zellePhone ?? null;
  }

  const updated = await db.transaction(async (tx) => {
    if (wantsDefault && !existing.isDefault) {
      await tx
        .update(writerPayoutMethods)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(writerPayoutMethods.writerId, session.user.id));
      updates.isDefault = true;
    }
    const [row] = await tx
      .update(writerPayoutMethods)
      .set(updates)
      .where(eq(writerPayoutMethods.id, id))
      .returning();
    return row;
  });

  return Response.json(maskPayoutMethodForWriter(updated));
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.query.writerPayoutMethods.findFirst({
    where: and(
      eq(writerPayoutMethods.id, id),
      eq(writerPayoutMethods.writerId, session.user.id),
    ),
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(writerPayoutMethods).where(eq(writerPayoutMethods.id, id));
    // If we deleted the default, promote the most recently updated remaining
    // method (if any) to default. Writers without any method on file can't
    // request payouts at all, so we don't need a fallback for the no-rows case.
    if (existing.isDefault) {
      const next = await tx.query.writerPayoutMethods.findFirst({
        where: eq(writerPayoutMethods.writerId, session.user.id),
        orderBy: (m, { desc }) => [desc(m.updatedAt)],
      });
      if (next) {
        await tx
          .update(writerPayoutMethods)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(writerPayoutMethods.id, next.id));
      }
    }
  });

  return Response.json({ ok: true });
}
