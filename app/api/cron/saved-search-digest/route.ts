// Saved-search digest cron.
//
// Vercel Cron invokes this on the schedule in vercel.json. Gated on CRON_SECRET
// so it can't be triggered publicly, matching /api/cron/studio-refetch.
//
// One email per reader covering all of their due searches. Readers whose send
// fails keep their watermark and are retried on the next run.

import { runDigest } from "@/lib/saved-search/digest";
import { sendSavedSearchDigestEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";

  const startedAt = Date.now();

  try {
    const report = await runDigest({
      send: async (payload) => {
        if (dryRun) {
          console.log(
            `[saved-search] dry run: would email ${payload.email} about ${payload.totalMatches} matches`,
          );
          return;
        }
        await sendSavedSearchDigestEmail({
          userId: payload.userId,
          email: payload.email,
          name: payload.name,
          totalMatches: payload.totalMatches,
          sections: payload.sections.map((section) => ({
            name: section.name,
            description: section.description,
            href: section.href,
            matches: section.matches.map((m) => ({
              slug: m.slug,
              title: m.title,
              universityName: m.universityName,
              admittedYear: m.admittedYear,
              priceCents: m.priceCents,
            })),
          })),
        });
      },
    });

    return Response.json({
      ...report,
      dryRun,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("[saved-search] digest run failed", err);
    return Response.json({ error: "digest_failed" }, { status: 500 });
  }
}
