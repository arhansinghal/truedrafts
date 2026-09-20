/**
 * The saved-search digest job.
 *
 * Runs on a schedule (see vercel.json), finds applications published since each
 * saved search's watermark, and sends one email per reader covering all of
 * their searches — not one email per search, which would mean four emails on a
 * busy week for someone who saved four things.
 *
 * Failure policy: a reader whose email bounces must not block anyone else, and
 * must not lose their place. Each reader is processed independently and the
 * watermark only moves when their send succeeded.
 */

import { db } from "@/lib/db";
import { savedSearches, users } from "@/lib/db/schema";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";

import { parseFilters, describeFilters, browseHref } from "./filters";
import { findNewMatches, universityIdForSlug, type MatchRow } from "./match";

/** Most applications any one search contributes to a single digest. */
const MAX_MATCHES_PER_SEARCH = 8;

/** Most applications in one email, across all of a reader's searches. */
const MAX_MATCHES_PER_EMAIL = 20;

/** How far back a never-notified search looks on its first run. */
const FIRST_RUN_LOOKBACK_DAYS = 14;

/** Cadence → minimum gap between digests. */
const CADENCE_DAYS: Record<"daily" | "weekly", number> = {
  daily: 1,
  weekly: 7,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type DigestSection = {
  savedSearchId: string;
  name: string;
  description: string;
  href: string;
  matches: MatchRow[];
};

export type DigestPayload = {
  userId: string;
  email: string;
  name: string;
  sections: DigestSection[];
  totalMatches: number;
};

export type DigestReport = {
  scanned: number;
  usersConsidered: number;
  emailsSent: number;
  matchesSent: number;
  failures: number;
};

/** Is this search due, given its cadence and watermark? */
export function isDue(
  search: { cadence: string; lastNotifiedAt: Date | null },
  now: Date,
): boolean {
  if (search.cadence !== "daily" && search.cadence !== "weekly") return false;
  if (!search.lastNotifiedAt) return true;

  const gapDays = CADENCE_DAYS[search.cadence];
  const elapsed = now.getTime() - search.lastNotifiedAt.getTime();
  return elapsed >= gapDays * DAY_MS;
}

/** Where a search starts looking, given its watermark. */
export function windowStart(
  lastNotifiedAt: Date | null,
  now: Date,
): Date {
  if (lastNotifiedAt) return lastNotifiedAt;
  // Never notified: don't email someone the entire back catalogue on day one.
  return new Date(now.getTime() - FIRST_RUN_LOOKBACK_DAYS * DAY_MS);
}

type SavedSearchRow = typeof savedSearches.$inferSelect;

/**
 * Build one reader's digest.
 *
 * Returns null when nothing new matched — we don't send "here is nothing".
 */
export async function buildDigestForUser(input: {
  user: { id: string; email: string; name: string };
  searches: SavedSearchRow[];
  now: Date;
}): Promise<DigestPayload | null> {
  const { user, searches, now } = input;
  const sections: DigestSection[] = [];
  let totalMatches = 0;

  for (const search of searches) {
    // Don't show the same application twice in one digest.
    const seen = new Set<string>();

    const filters = parseFilters(search.filters);
    const universityId = filters.university
      ? await universityIdForSlug(filters.university)
      : null;

    // A saved search pinned to a university that has since been removed can
    // never match; skip it rather than silently widening to every school.
    if (filters.university && !universityId) continue;

    const since = windowStart(search.lastNotifiedAt, now);
    const matches = await findNewMatches({
      filters,
      universityId,
      since,
      until: now,
      limit: MAX_MATCHES_PER_SEARCH,
    });

    const fresh = matches.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    if (fresh.length === 0) continue;

    sections.push({
      savedSearchId: search.id,
      name: search.name,
      description: describeFilters(filters),
      href: browseHref(filters),
      matches: fresh,
    });
    totalMatches += fresh.length;

    if (totalMatches >= MAX_MATCHES_PER_EMAIL) break;
  }

  if (sections.length === 0) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    sections,
    totalMatches,
  };
}

/**
 * Run the digest across every reader with a due saved search.
 *
 * `send` is injected so the cron route can pass the real mailer and a dry run
 * can pass a no-op.
 */
export async function runDigest(input: {
  now?: Date;
  maxUsers?: number;
  send: (payload: DigestPayload) => Promise<void>;
}): Promise<DigestReport> {
  const now = input.now ?? new Date();
  const maxUsers = input.maxUsers ?? 200;

  const report: DigestReport = {
    scanned: 0,
    usersConsidered: 0,
    emailsSent: 0,
    matchesSent: 0,
    failures: 0,
  };

  // Everything that wants mail at all, oldest watermark first so a backlog
  // drains fairly rather than always serving the same readers.
  const candidates = await db
    .select()
    .from(savedSearches)
    .where(ne(savedSearches.cadence, "off"))
    .orderBy(asc(savedSearches.lastNotifiedAt));

  report.scanned = candidates.length;

  const due = candidates.filter((s) => isDue(s, now));
  if (due.length === 0) return report;

  // Group by reader so each one gets a single email.
  const byUser = new Map<string, SavedSearchRow[]>();
  for (const search of due) {
    const list = byUser.get(search.userId);
    if (list) list.push(search);
    else byUser.set(search.userId, [search]);
  }

  const userIds = Array.from(byUser.keys()).slice(0, maxUsers);
  report.usersConsidered = userIds.length;

  const recipients = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  for (const recipient of recipients) {
    // Deleted accounts keep their rows for purchase history but must never be
    // emailed again.
    if (recipient.deletedAt) continue;

    const searches = byUser.get(recipient.id) ?? [];

    try {
      const payload = await buildDigestForUser({
        user: {
          id: recipient.id,
          email: recipient.email,
          name: recipient.name,
        },
        searches,
        now,
      });

      if (!payload) {
        // Nothing new. Still move the watermark — otherwise a quiet search
        // re-scans the same empty window every single run.
        await stampWatermark(searches.map((s) => s.id), 0);
        continue;
      }

      await input.send(payload);
      report.emailsSent += 1;
      report.matchesSent += payload.totalMatches;

      await stampWatermark(
        searches.map((s) => s.id),
        payload.totalMatches,
      );
    } catch (err) {
      console.error(
        `[saved-search] digest failed for user ${recipient.id}`,
        err,
      );
      report.failures += 1;
      // Watermark deliberately untouched: the next run retries this window.
    }
  }

  return report;
}

/** Move the watermark forward for a reader's searches. */
async function stampWatermark(
  ids: string[],
  matchesSent: number,
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(savedSearches)
    .set({
      lastNotifiedAt: new Date(),
      matchesSent: sql`${savedSearches.matchesSent} + ${matchesSent}`,
      updatedAt: new Date(),
    })
    .where(inArray(savedSearches.id, ids));
}

/** Count of a reader's saved searches, used to enforce the per-reader cap. */
export async function countForUser(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(savedSearches)
    .where(and(eq(savedSearches.userId, userId)));
  return rows[0]?.count ?? 0;
}
