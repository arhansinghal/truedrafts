/**
 * Writing to the admin audit log.
 *
 * Call this after the mutation has actually landed, so the log never claims
 * something happened that then failed. Writes are best-effort and never throw
 * at the caller: an admin action that succeeded must not report failure because
 * the bookkeeping row didn't insert.
 */

import { db } from "@/lib/db";
import { adminAuditLog } from "@/lib/db/schema";
import { redact } from "./redact";

/** The verbs we record. Keeping them in one place stops the log growing typos. */
export const AUDIT_ACTIONS = {
  applicationApprove: "application.approve",
  applicationReject: "application.reject",
  essayApprove: "essay.approve",
  essayReject: "essay.reject",
  userUpdate: "user.update",
  userDelete: "user.delete",
  payoutTransition: "payout.transition",
  purchaseRefund: "purchase.refund",
  bundlePublish: "bundle.publish",
  bundleArchive: "bundle.archive",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Best-effort client IP, taken from the proxy chain's left-most entry. */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || null;
}

export type RecordInput = {
  req: Request;
  actor: { id: string; email: string };
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  /** State before the change. Redacted before storage. */
  before?: unknown;
  /** State after the change. Redacted before storage. */
  after?: unknown;
};

/**
 * Append one entry.
 *
 * Both snapshots run through `redact` here rather than at the call sites, so a
 * new admin route cannot forget to do it.
 */
export async function recordAdminAction(input: RecordInput): Promise<void> {
  try {
    const userAgent = input.req.headers.get("user-agent");

    await db.insert(adminAuditLog).values({
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      beforeJson:
        input.before === undefined
          ? null
          : JSON.stringify(redact(input.before)),
      afterJson:
        input.after === undefined ? null : JSON.stringify(redact(input.after)),
      ipAddress: clientIp(input.req),
      // Long enough to identify a browser, short enough not to bloat the row.
      userAgent: userAgent ? userAgent.slice(0, 300) : null,
    });
  } catch (err) {
    console.error("[audit] failed to record admin action", {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      err,
    });
  }
}
