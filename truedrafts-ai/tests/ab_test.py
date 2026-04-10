"""
A/B Test Harness — Hybrid Search vs Pure Text Search

Group A (Hybrid):  ILIKE on vibeSearchText (AI-tagged) + Reranker scoring
Group B (Control): ILIKE on raw text fields (title, commonAppContent, supplementals)

Metric: Relevance@10 — human-judged or auto-judged relevance of the top-10 results.

Usage:
  python -m tests.ab_test --queries queries.json --db $DATABASE_URL --ai http://localhost:8000

Output: ab_results.json with per-query scores and aggregate statistics.
"""
from __future__ import annotations
import argparse, asyncio, json, math, statistics, time
from datetime import datetime

import asyncpg
import httpx

# ── Queries to test ────────────────────────────────────────────────────────────
DEFAULT_QUERIES = [
    {"q": "first-gen student Yale resilience", "relevant_themes": ["first-gen", "resilience", "family"]},
    {"q": "funny failure essay MIT engineering", "relevant_themes": ["failure", "engineering", "humor"]},
    {"q": "immigrant identity Harvard community", "relevant_themes": ["immigration", "identity", "community"]},
    {"q": "chess national champion leadership", "relevant_themes": ["chess", "leadership", "competition"]},
    {"q": "robotics STEM analytical Penn",     "relevant_themes": ["robotics", "STEM", "analytical"]},
    {"q": "creative writing artist Stanford",  "relevant_themes": ["art", "creativity", "writing"]},
    {"q": "overcome disability earnest",       "relevant_themes": ["disability", "overcoming", "growth"]},
    {"q": "athletic injury comeback",          "relevant_themes": ["sports", "injury", "perseverance"]},
]


# ── DB helpers ─────────────────────────────────────────────────────────────────

async def hybrid_search(pool: asyncpg.Pool, ai_base: str, query: str, relevant_themes: list[str]) -> list[dict]:
    """Group A: Parse → ILIKE on vibeSearchText → Rerank with AI."""
    async with httpx.AsyncClient(base_url=ai_base, timeout=10) as client:
        parse_resp = await client.get("/parse", params={"q": query})
        intent = parse_resp.json()

    themes = intent.get("themes", [])
    keywords = intent.get("semantic_keywords", query)

    # Build ILIKE conditions
    if themes:
        conditions = " OR ".join(
            f"(vibe_search_text ILIKE '%{t}%' OR title ILIKE '%{t}%')"
            for t in themes[:5]
        )
        sql = f"""
            SELECT id, title, vibe_search_text, insight_brief
            FROM college_applications
            WHERE status = 'approved'
              AND ({conditions})
            LIMIT 30
        """
    else:
        sql = f"""
            SELECT id, title, vibe_search_text, insight_brief
            FROM college_applications
            WHERE status = 'approved'
              AND (title ILIKE '%{keywords}%' OR vibe_search_text ILIKE '%{keywords}%')
            LIMIT 30
        """

    rows = await pool.fetch(sql)
    results = []
    for r in rows:
        brief = {}
        try:
            if r["insight_brief"]:
                brief = json.loads(r["insight_brief"])
        except Exception:
            pass
        results.append({"id": str(r["id"]), "title": r["title"], "brief": brief})

    # Rerank top-20 with AI
    if results and any(r["brief"] for r in results):
        rerank_items = [{"id": r["id"], "brief": r["brief"]} for r in results[:20] if r["brief"]]
        async with httpx.AsyncClient(base_url=ai_base, timeout=30) as client:
            try:
                rr_resp = await client.post("/rerank", json={"intent": intent, "items": rerank_items})
                scores = {s["id"]: s["score"] for s in rr_resp.json().get("scores", [])}
                results = sorted(results, key=lambda r: scores.get(r["id"], 0), reverse=True)
            except Exception:
                pass  # Fall back to original order if reranker fails

    return results[:10]


async def text_search(pool: asyncpg.Pool, query: str) -> list[dict]:
    """Group B: Plain ILIKE on raw text (current behavior)."""
    words = query.split()[:5]
    conditions = " OR ".join(
        f"(title ILIKE '%{w}%' OR common_app_content ILIKE '%{w}%' OR supplementals ILIKE '%{w}%')"
        for w in words
    )
    sql = f"""
        SELECT id, title
        FROM college_applications
        WHERE status = 'approved'
          AND ({conditions})
        LIMIT 10
    """
    rows = await pool.fetch(sql)
    return [{"id": str(r["id"]), "title": r["title"]} for r in rows]


# ── Relevance scoring ──────────────────────────────────────────────────────────

def auto_relevance_score(results: list[dict], relevant_themes: list[str]) -> float:
    """
    Automatic relevance scoring based on theme presence in titles and briefs.
    Returns a score 0-1 (DCG-based, higher rank = more weight).
    In production, replace with human labels or click-through data.
    """
    if not results:
        return 0.0

    dcg = 0.0
    for rank, result in enumerate(results, start=1):
        # Check if any relevant theme appears in title or brief text
        haystack = result.get("title", "").lower()
        if isinstance(result.get("brief"), dict):
            haystack += " " + " ".join(result["brief"].values()).lower()

        gain = sum(1 for theme in relevant_themes if theme.lower() in haystack)
        gain = min(gain, 1)  # Binary relevance
        dcg += gain / math.log2(rank + 1)

    # Ideal DCG: all top results are relevant
    idcg = sum(1 / math.log2(i + 2) for i in range(min(len(relevant_themes), len(results))))
    return dcg / idcg if idcg > 0 else 0.0


# ── Main ──────────────────────────────────────────────────────────────────────

async def run_ab_test(db_url: str, ai_base: str, queries: list[dict]) -> dict:
    pool = await asyncpg.create_pool(dsn=db_url, min_size=2, max_size=5, ssl="require")

    results = []
    hybrid_scores, control_scores = [], []

    for q in queries:
        query        = q["q"]
        rel_themes   = q.get("relevant_themes", [])
        print(f"\nQuery: {query!r}")

        t0 = time.monotonic()
        hybrid_results = await hybrid_search(pool, ai_base, query, rel_themes)
        hybrid_ms = int((time.monotonic() - t0) * 1000)

        t0 = time.monotonic()
        control_results = await text_search(pool, query)
        control_ms = int((time.monotonic() - t0) * 1000)

        h_score = auto_relevance_score(hybrid_results,  rel_themes)
        c_score = auto_relevance_score(control_results, rel_themes)

        hybrid_scores.append(h_score)
        control_scores.append(c_score)

        print(f"  Hybrid:  nDCG={h_score:.3f}  latency={hybrid_ms}ms  results={len(hybrid_results)}")
        print(f"  Control: nDCG={c_score:.3f}  latency={control_ms}ms  results={len(control_results)}")

        results.append({
            "query":           query,
            "relevant_themes": rel_themes,
            "hybrid":          {"ndcg": h_score, "latency_ms": hybrid_ms, "count": len(hybrid_results)},
            "control":         {"ndcg": c_score, "latency_ms": control_ms, "count": len(control_results)},
            "winner":          "hybrid" if h_score > c_score else ("tie" if h_score == c_score else "control"),
        })

    await pool.close()

    summary = {
        "run_at":            datetime.utcnow().isoformat(),
        "queries_tested":    len(queries),
        "hybrid_mean_ndcg":  statistics.mean(hybrid_scores)  if hybrid_scores  else 0,
        "control_mean_ndcg": statistics.mean(control_scores) if control_scores else 0,
        "hybrid_wins":       sum(1 for r in results if r["winner"] == "hybrid"),
        "control_wins":      sum(1 for r in results if r["winner"] == "control"),
        "ties":              sum(1 for r in results if r["winner"] == "tie"),
        "per_query":         results,
    }

    improvement = (
        (summary["hybrid_mean_ndcg"] - summary["control_mean_ndcg"])
        / summary["control_mean_ndcg"] * 100
        if summary["control_mean_ndcg"] > 0 else 0
    )
    print(f"\n{'='*50}")
    print(f"RESULTS: Hybrid nDCG={summary['hybrid_mean_ndcg']:.3f}  Control nDCG={summary['control_mean_ndcg']:.3f}")
    print(f"Improvement: {improvement:+.1f}%  Hybrid wins: {summary['hybrid_wins']}/{len(queries)}")
    print(f"{'='*50}")
    return summary


def main():
    parser = argparse.ArgumentParser(description="A/B test: Hybrid vs Text search")
    parser.add_argument("--db",      required=True, help="DATABASE_URL (Neon connection string)")
    parser.add_argument("--ai",      default="http://localhost:8000", help="AI service base URL")
    parser.add_argument("--queries", default=None, help="Path to queries JSON file")
    parser.add_argument("--output",  default="ab_results.json", help="Output file")
    args = parser.parse_args()

    if args.queries:
        with open(args.queries) as f:
            queries = json.load(f)
    else:
        queries = DEFAULT_QUERIES

    summary = asyncio.run(run_ab_test(args.db, args.ai, queries))

    with open(args.output, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nFull results written to {args.output}")


if __name__ == "__main__":
    main()
