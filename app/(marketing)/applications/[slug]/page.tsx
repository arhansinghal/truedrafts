import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { collegeApplications, purchases } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { parseInsightBrief } from "@/components/applications/InsightPreview";
import { ApplicationReader, type ReaderEssay, type ReaderData } from "@/components/applications/ApplicationReader";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ purchased?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const app = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.slug, slug),
    columns: { title: true, admittedYear: true },
    with: { university: { columns: { name: true } } },
  });
  if (!app) return {};
  return {
    title: app.title,
    description: `Full college application to ${app.university?.name}. Class of ${app.admittedYear ?? "recent year"}.`,
  };
}

function splitParas(content: string): string[] {
  if (!content) return [];
  let parts = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    parts = content
      .split(/\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return parts.length ? parts : [content.trim()];
}

function wordCount(content: string): number {
  return content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
}

function supplementTitle(prompt: string | undefined, i: number): string {
  if (prompt) {
    const words = prompt.replace(/\s+/g, " ").trim().split(" ");
    const short = words.slice(0, 6).join(" ");
    return short.length < prompt.trim().length ? short + "…" : short;
  }
  return `Supplemental ${i + 1}`;
}

export default async function ApplicationDetailPage({ params }: Props) {
  const { slug } = await params;

  const [app, session] = await Promise.all([
    db.query.collegeApplications.findFirst({
      where: eq(collegeApplications.slug, slug),
      // Need the full essay text here, but never the 1024-dim embedding vector.
      columns: { insightBriefEmbedding: false },
      with: {
        university: true,
        writer: { columns: { id: true, name: true, email: true, username: true, verifiedAdmit: true, bio: true } },
      },
    }),
    auth.api.getSession({ headers: await headers() }),
  ]);

  if (!app) notFound();

  let isPurchased = false;
  if (session) {
    const existingPurchase = await db.query.purchases.findFirst({
      where: and(
        eq(purchases.buyerId, session.user.id),
        eq(purchases.applicationId, app.id),
        eq(purchases.status, "completed"),
      ),
    });
    isPurchased = !!existingPurchase || session.user.id === app.writerId;
  }

  // Only "approved" applications are publicly visible. Non-approved states
  // (pending/rejected, or "archived" after the writer deletes a listing) stay
  // reachable for the writer and for anyone who already purchased — so past
  // buyers keep access to a delisted application.
  if (app.status !== "approved" && !isPurchased) notFound();

  let supplementals: { prompt?: string; content?: string }[] = [];
  try {
    supplementals = JSON.parse(app.supplementals ?? "[]");
  } catch {
    supplementals = [];
  }

  // Build the essay list: Common App first, then supplementals.
  const essays: ReaderEssay[] = [];
  if (app.submittedCommonApp && app.commonAppContent) {
    essays.push({
      kind: "Personal statement",
      title: "Personal Statement",
      prompt: app.commonAppPrompt ?? undefined,
      words: wordCount(app.commonAppContent),
      paras: splitParas(app.commonAppContent),
    });
  }
  supplementals.forEach((sup, i) => {
    if (!sup.content) return;
    essays.push({
      kind: "Supplemental",
      title: supplementTitle(sup.prompt, i),
      prompt: sup.prompt,
      words: wordCount(sup.content),
      paras: splitParas(sup.content),
    });
  });

  const insightBrief = parseInsightBrief(app.insightBrief);
  const themes = (insightBrief?.common_app?.topics ?? app.tags ?? [])
    .filter(Boolean)
    .map((t) => t.replace(/_/g, " "));
  const marginNotes = (insightBrief?.what_youll_learn ?? []).filter(Boolean);
  const editorNote = insightBrief?.common_app?.summary?.trim() || null;

  const totalWords = essays.reduce((sum, e) => sum + (e.words ?? 0), 0);
  const readMins = Math.max(1, Math.round(totalWords / 200));

  // PAYWALL: never ship full essay text to a non-purchaser. The reader is a
  // client component, so anything in `data` reaches the browser. For locked
  // viewers we send only a short teaser — the first essay's opening paragraphs —
  // and nothing for the rest. Word counts / titles / prompts stay (metadata).
  // After purchase, ApplicationPaywall calls router.refresh(); this server
  // component re-runs with isPurchased=true and delivers the full text.
  const PREVIEW_PARAS = 3;
  const gatedEssays: ReaderEssay[] = isPurchased
    ? essays
    : essays.map((e, i) => ({
        ...e,
        paras: i === 0 ? e.paras.slice(0, PREVIEW_PARAS) : [],
      }));

  const data: ReaderData = {
    id: app.id,
    slug: app.slug,
    title: app.title,
    priceCents: app.priceCents,
    university: { name: app.university.name, slug: app.university.slug },
    admittedYear: app.admittedYear,
    editorNote,
    themes,
    marginNotes,
    readMins,
    essays: gatedEssays,
    isPurchased,
    isLoggedIn: !!session,
    watermarkEmail: isPurchased && session ? session.user.email : null,
    writer: isPurchased
      ? { name: app.writer.name, bio: app.writer.bio, verifiedAdmit: !!app.writer.verifiedAdmit }
      : null,
  };

  return <ApplicationReader data={data} />;
}
