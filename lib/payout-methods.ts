// Validation, masking, and DTOs for writer payout methods.
//
// Three kinds:
//   upi          — Indian VPA (e.g. user@paytm, 9876543210@upi)
//   bank_account — Indian bank: account number + IFSC
//   zelle        — US: email OR US phone number
//
// All validation lives here, so API routes can call one entry point and trust
// the result. We do NOT touch the network — these are pure local checks.

export type PayoutMethodKind = "upi" | "bank_account" | "zelle";

type UpiInput = {
  kind: "upi";
  accountHolderName: string;
  upiId: string;
};

type BankAccountInput = {
  kind: "bank_account";
  accountHolderName: string;
  bankAccountNumber: string;
  bankIfsc: string;
};

type ZelleInput = {
  kind: "zelle";
  accountHolderName: string;
  zelleEmail?: string;
  zellePhone?: string;
};

type PayoutMethodInput = UpiInput | BankAccountInput | ZelleInput;

// What we return to the writer's browser. Sensitive fields are masked.
export type MaskedPayoutMethod = {
  id: string;
  kind: PayoutMethodKind;
  isDefault: boolean;
  accountHolderName: string;
  upiId?: string | null;
  bankAccountNumberMasked?: string | null;
  bankIfsc?: string | null;
  zelleEmail?: string | null;
  zellePhone?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Cheap regex checks (good enough; banks/UPI providers do the real validation).
const UPI_RE = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_ACCT_RE = /^[0-9]{8,20}$/; // Indian bank accounts: 8–20 digits
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const US_PHONE_RE = /^\+?1?[2-9][0-9]{9}$/; // +1XXXXXXXXXX or 10-digit

export function validatePayoutMethodInput(
  raw: unknown,
): { ok: true; value: PayoutMethodInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Body must be an object" };
  }
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  const accountHolderName =
    typeof r.accountHolderName === "string" ? r.accountHolderName.trim() : "";

  if (accountHolderName.length < 2 || accountHolderName.length > 100) {
    return { ok: false, error: "accountHolderName must be 2–100 chars" };
  }

  if (kind === "upi") {
    const upiId =
      typeof r.upiId === "string" ? r.upiId.trim().toLowerCase() : "";
    if (!UPI_RE.test(upiId)) {
      return { ok: false, error: "Invalid UPI ID (expected user@provider)" };
    }
    return { ok: true, value: { kind, accountHolderName, upiId } };
  }

  if (kind === "bank_account") {
    const bankAccountNumber =
      typeof r.bankAccountNumber === "string"
        ? r.bankAccountNumber.replace(/\s+/g, "")
        : "";
    const bankIfsc =
      typeof r.bankIfsc === "string" ? r.bankIfsc.trim().toUpperCase() : "";
    if (!BANK_ACCT_RE.test(bankAccountNumber)) {
      return { ok: false, error: "Bank account number must be 8–20 digits" };
    }
    if (!IFSC_RE.test(bankIfsc)) {
      return { ok: false, error: "Invalid IFSC (e.g. HDFC0001234)" };
    }
    return {
      ok: true,
      value: { kind, accountHolderName, bankAccountNumber, bankIfsc },
    };
  }

  if (kind === "zelle") {
    const zelleEmail =
      typeof r.zelleEmail === "string" ? r.zelleEmail.trim().toLowerCase() : "";
    const zellePhone =
      typeof r.zellePhone === "string"
        ? r.zellePhone.replace(/[\s()-]/g, "")
        : "";
    if (!zelleEmail && !zellePhone) {
      return { ok: false, error: "Provide a Zelle email or US phone number" };
    }
    if (zelleEmail && !EMAIL_RE.test(zelleEmail)) {
      return { ok: false, error: "Invalid Zelle email" };
    }
    if (zellePhone && !US_PHONE_RE.test(zellePhone)) {
      return { ok: false, error: "Invalid US phone (e.g. +14155550123)" };
    }
    return {
      ok: true,
      value: {
        kind,
        accountHolderName,
        ...(zelleEmail ? { zelleEmail } : {}),
        ...(zellePhone ? { zellePhone } : {}),
      },
    };
  }

  return { ok: false, error: "kind must be 'upi', 'bank_account', or 'zelle'" };
}

// Take a DB row (with encrypted bank fields) and produce a safe, masked view
// for the writer's browser. Never sends the decrypted account number.
export function maskPayoutMethodForWriter(row: {
  id: string;
  kind: PayoutMethodKind;
  isDefault: boolean;
  accountHolderName: string;
  upiId: string | null;
  bankAccountNumberLast4: string | null;
  bankIfsc: string | null;
  zelleEmail: string | null;
  zellePhone: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MaskedPayoutMethod {
  return {
    id: row.id,
    kind: row.kind,
    isDefault: row.isDefault,
    accountHolderName: row.accountHolderName,
    upiId: row.upiId,
    bankAccountNumberMasked: row.bankAccountNumberLast4
      ? `XXXX-XXXX-${row.bankAccountNumberLast4}`
      : null,
    bankIfsc: row.bankIfsc,
    zelleEmail: row.zelleEmail,
    zellePhone: row.zellePhone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// The snapshot we store on the payouts row at request time. It's the masked
// view PLUS a marker that this came from method X. Historical records survive
// the writer later deleting or editing the method.
export function buildPayoutMethodSnapshot(
  method: MaskedPayoutMethod,
): string {
  return JSON.stringify({
    methodId: method.id,
    kind: method.kind,
    accountHolderName: method.accountHolderName,
    upiId: method.upiId ?? null,
    bankAccountNumberMasked: method.bankAccountNumberMasked ?? null,
    bankIfsc: method.bankIfsc ?? null,
    zelleEmail: method.zelleEmail ?? null,
    zellePhone: method.zellePhone ?? null,
  });
}
