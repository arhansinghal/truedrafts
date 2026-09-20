/**
 * Reading the admin audit log.
 *
 * Cursorless offset pagination: the log is browsed, not streamed, and admins
 * jump to a page number. `hasMore` comes from fetching one row past the page
 * rather than a second COUNT query — one round-trip instead of two, against a
 * database that is a second away.
 */

import { db } from "@/lib/db";
import { adminAuditLog } from "@/lib/db/schema";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { diffRedacted, summarizeChanges, type FieldChange, type Redacted } from "./redact";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export type AuditFilters = {
  action?: string | null;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  /** Inclusive lower bound on createdAt. */
  since?: Date | null;
  /** Inclusive upper bound on createdAt. */
  until?: Date | null;
};

export type AuditEntryView = {
  id: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  ipAddress: string | null;
  createdAt: Date;
  changes: FieldChange[];
  summary: string;
};

export type AuditPage = {
  entries: AuditEntryView[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/** Parse a stored JSON snapshot back into a redacted value. */
function parseSnapshot(json: string | null): Redacted {
  if (!json) return null;
  try {
    return JSON.parse(json) as Redacted;
  } catch {
    // A row written by an older shape, or truncated somehow. Better to show the
    // entry without its diff than to drop it from the log entirely.
    return null;
  }
}

/** Clamp a page size request into something the database is happy to serve. */
export function normalizePageSize(requested: unknown): number {
  const n = Number(requested);
  if (!Number.isFinite(n)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(n)));
}

/** Clamp a page number. Pages are 1-based. */
export function normalizePage(requested: unknown): number {
  const n = Number(requested);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function buildConditions(filters: AuditFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.action) {
    conditions.push(eq(adminAuditLog.action, filters.action));
  }
  if (filters.actorId) {
    conditions.push(eq(adminAuditLog.actorId, filters.actorId));
  }
  if (filters.targetType) {
    conditions.push(eq(adminAuditLog.targetType, filters.targetType));
  }
  if (filters.targetId) {
    conditions.push(eq(adminAuditLog.targetId, filters.targetId));
  }
  if (filters.since) {
    conditions.push(gte(adminAuditLog.createdAt, filters.since));
  }
  if (filters.until) {
    conditions.push(lte(adminAuditLog.createdAt, filters.until));
  }

  return conditions;
}

/**
 * One page of the log, newest first.
 *
 * Ordering is (createdAt DESC, id DESC): two entries written in the same
 * millisecond would otherwise be free to swap places between pages, which is
 * how a row shows up twice or not at all.
 */
export async function loadAuditPage(input: {
  page?: number;
  pageSize?: number;
  filters?: AuditFilters;
}): Promise<AuditPage> {
  const page = normalizePage(input.page ?? 1);
  const pageSize = normalizePageSize(input.pageSize ?? DEFAULT_PAGE_SIZE);
  const conditions = buildConditions(input.filters ?? {});

  const rows = await db
    .select()
    .from(adminAuditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);

  const hasMore = rows.length > pageSize;
  const visible = hasMore ? rows.slice(0, pageSize) : rows;

  const entries: AuditEntryView[] = visible.map((row) => {
    const changes = diffRedacted(
      parseSnapshot(row.beforeJson),
      parseSnapshot(row.afterJson),
    );
    return {
      id: row.id,
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      targetLabel: row.targetLabel,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
      changes,
      summary: summarizeChanges(changes),
    };
  });

  return { entries, page, pageSize, hasMore };
}

/** The distinct actions present in the log, for the filter dropdown. */
export async function distinctActions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ action: adminAuditLog.action })
    .from(adminAuditLog)
    .orderBy(adminAuditLog.action);
  return rows.map((row) => row.action);
}

/** Every entry touching one record, for the "history" panel on a detail page. */
export async function historyFor(
  targetType: string,
  targetId: string,
  limit = 20,
): Promise<AuditEntryView[]> {
  const { entries } = await loadAuditPage({
    pageSize: limit,
    filters: { targetType, targetId },
  });
  return entries;
}

/** Rows older than the retention window, used by the pruning script. */
export async function countOlderThan(cutoff: Date): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminAuditLog)
    .where(lte(adminAuditLog.createdAt, cutoff));
  return rows[0]?.count ?? 0;
}
