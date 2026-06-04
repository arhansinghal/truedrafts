// Retrieval orchestrator. Three corpora, fused at synthesis time.
//
//   1. Hub  — per-app source chunks. pgvector cosine similarity.
//   2. Library — insight briefs for the app's school. pgvector top-K.
//   3. Web  — Tavily, only when caller toggles it on.
//
// Returns role-tagged passages so the synthesizer prompt knows which to cite
// vs which to merely emulate.

import { db } from "@/lib/db";
import {
  collegeApplications,
  studioSourceChunks,
  studioSources,
  type StudioSource,
} from "@/lib/db/schema";
import { and, eq, sql, inArray } from "drizzle-orm";
import { embedOne, isEmbeddingsEnabled, toVectorLiteral } from "./embeddings";
import { tavilySearch, type TavilyResult } from "./tavily";

export type HubPassage = {
  kind: "hub";
  text: string;
  source: { id: string; title: string; uri: string; sourceKind: "url" | "pdf" };
  score: number;
};

export type LibraryPassage = {
  kind: "library";
  text: string;
  source: { applicationId: string; applicationTitle: string };
  score: number;
};

export type WebPassage = {
  kind: "web";
  text: string;
  source: { title: string; url: string };
  score: number;
};

export type RetrievalBundle = {
  hub: HubPassage[];
  library: LibraryPassage[];
  web: WebPassage[];
};

const HUB_TOP_K = 4;
const LIBRARY_TOP_K = 4;

export async function retrieve(opts: {
  query: string;
  topicHint: string;
  appId: string;
  universityId: string;
  webEnabled: boolean;
}): Promise<RetrievalBundle> {
  const { query, topicHint, appId, universityId, webEnabled } = opts;

  // Combine sentence + topic hint for richer query embedding.
  const queryText = topicHint ? `${query} ${topicHint}` : query;

  const [queryEmbedding, webResults] = await Promise.all([
    isEmbeddingsEnabled() ? embedOne(queryText, "query") : Promise.resolve(null),
    webEnabled ? tavilySearch(topicHint || query) : Promise.resolve([] as TavilyResult[]),
  ]);

  const [hub, library] = await Promise.all([
    queryEmbedding
      ? hubSearch(appId, queryEmbedding)
      : hubFallback(appId, queryText),
    queryEmbedding
      ? librarySearch(universityId, queryEmbedding)
      : Promise.resolve([] as LibraryPassage[]),
  ]);

  const web: WebPassage[] = webResults.map((r) => ({
    kind: "web",
    text: r.snippet,
    source: { title: r.title, url: r.url },
    score: r.score,
  }));

  return { hub, library, web };
}

async function hubSearch(appId: string, queryEmbedding: number[]): Promise<HubPassage[]> {
  const lit = toVectorLiteral(queryEmbedding);
  // Drizzle doesn't yet expose the <=> operator natively, so we use sql`` and
  // pass the vector literal as a parameter. Negate the distance into a score.
  const rows = await db
    .select({
      text: studioSourceChunks.text,
      sourceId: studioSources.id,
      sourceTitle: studioSources.title,
      sourceUri: studioSources.uri,
      sourceKind: studioSources.kind,
      distance: sql<number>`${studioSourceChunks.embedding} <=> ${lit}::vector`,
    })
    .from(studioSourceChunks)
    .innerJoin(studioSources, eq(studioSources.id, studioSourceChunks.sourceId))
    .where(
      and(
        eq(studioSourceChunks.appId, appId),
        eq(studioSources.status, "ready"),
        sql`${studioSourceChunks.embedding} IS NOT NULL`,
      ),
    )
    .orderBy(sql`${studioSourceChunks.embedding} <=> ${lit}::vector`)
    .limit(HUB_TOP_K);

  return rows.map((r) => ({
    kind: "hub" as const,
    text: r.text,
    source: {
      id: r.sourceId,
      title: r.sourceTitle,
      uri: r.sourceUri,
      sourceKind: r.sourceKind as "url" | "pdf",
    },
    score: 1 - r.distance,
  }));
}

// ILIKE fallback when no embeddings (Voyage key absent or embedding failed).
async function hubFallback(appId: string, queryText: string): Promise<HubPassage[]> {
  const tokens = queryText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3)
    .slice(0, 6);
  if (tokens.length === 0) return [];

  const conditions = tokens.map((t) => sql`lower(${studioSourceChunks.text}) LIKE ${"%" + t + "%"}`);
  const rows = await db
    .select({
      text: studioSourceChunks.text,
      sourceId: studioSources.id,
      sourceTitle: studioSources.title,
      sourceUri: studioSources.uri,
      sourceKind: studioSources.kind,
    })
    .from(studioSourceChunks)
    .innerJoin(studioSources, eq(studioSources.id, studioSourceChunks.sourceId))
    .where(and(eq(studioSourceChunks.appId, appId), eq(studioSources.status, "ready"), sql`(${sql.join(conditions, sql` OR `)})`))
    .limit(HUB_TOP_K);

  return rows.map((r) => ({
    kind: "hub" as const,
    text: r.text,
    source: {
      id: r.sourceId,
      title: r.sourceTitle,
      uri: r.sourceUri,
      sourceKind: r.sourceKind as "url" | "pdf",
    },
    score: 0.5,
  }));
}

async function librarySearch(
  universityId: string,
  queryEmbedding: number[],
): Promise<LibraryPassage[]> {
  const lit = toVectorLiteral(queryEmbedding);
  const rows = await db
    .select({
      id: collegeApplications.id,
      title: collegeApplications.title,
      brief: collegeApplications.insightBrief,
      distance: sql<number>`${collegeApplications.insightBriefEmbedding} <=> ${lit}::vector`,
    })
    .from(collegeApplications)
    .where(
      and(
        eq(collegeApplications.universityId, universityId),
        eq(collegeApplications.status, "approved"),
        sql`${collegeApplications.insightBriefEmbedding} IS NOT NULL`,
      ),
    )
    .orderBy(sql`${collegeApplications.insightBriefEmbedding} <=> ${lit}::vector`)
    .limit(LIBRARY_TOP_K);

  return rows
    .map((r) => {
      const summary = extractSummary(r.brief);
      if (!summary) return null;
      return {
        kind: "library" as const,
        text: summary,
        source: { applicationId: r.id, applicationTitle: r.title },
        score: 1 - r.distance,
      } satisfies LibraryPassage;
    })
    .filter((x): x is LibraryPassage => x !== null);
}

function extractSummary(briefJson: string | null): string | null {
  if (!briefJson) return null;
  try {
    const obj = JSON.parse(briefJson) as Record<string, unknown>;
    const parts: string[] = [];
    const summary = pickString(obj, ["summary", "essay_focus", "common_app", "common_app_summary"]);
    if (summary) parts.push(summary);
    const why = pickString(obj, ["why_it_worked"]);
    if (why) parts.push(`Why it worked: ${why}`);
    const topics = (obj["topics"] as unknown) ?? (obj["common_app"] as Record<string, unknown> | undefined)?.["topics"];
    if (Array.isArray(topics) && topics.length > 0) {
      parts.push(`Topics: ${topics.slice(0, 6).join(", ")}`);
    }
    const tone = pickString(obj, ["tone_signature", "tone"]);
    if (tone) parts.push(`Tone: ${tone}`);
    return parts.join(". ").trim() || null;
  } catch {
    return null;
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = pickString(v as Record<string, unknown>, keys);
      if (inner) return inner;
    }
  }
  return null;
}

// Suppresses unused warnings; reserved for future caller-side filtering.
export const _internal = { inArray, type: { source: {} as StudioSource } };
