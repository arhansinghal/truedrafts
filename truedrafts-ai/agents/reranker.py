"""
THE RERANKER — Qwen3-30B-A3B with Chain-of-Thought thinking
Scores a set of Insight Briefs against a SearchIntent.
Used post-retrieval to re-sort the top-K results by true relevance.
"""
from __future__ import annotations
import asyncio, json, os
from openai import AsyncOpenAI

SILICONFLOW_BASE = "https://api.siliconflow.cn/v1"
RERANKER_MODEL   = "Qwen/Qwen3-30B-A3B"   # same MoE model with /think enabled below

_client_cache: AsyncOpenAI | None = None


def _client() -> AsyncOpenAI:
    global _client_cache
    if _client_cache is None:
        _client_cache = AsyncOpenAI(
            api_key=os.environ["SILICONFLOW_API_KEY"],
            base_url=SILICONFLOW_BASE,
        )
    return _client_cache


SYSTEM_PROMPT = """/think
You are a college essay relevance judge. A buyer has searched for essays using a specific intent.
For each essay brief provided, output a JSON array of scores.

Return ONLY a JSON array — no markdown, no explanation.
Each element: {"id": "<essay_id>", "score": <0-100>, "reason": "<≤15 word reason>"}

Scoring guide:
- 90-100: Perfect match on tone, themes, and target university
- 70-89:  Strong thematic match, minor tone mismatch
- 50-69:  Partial match on themes or tone
- 20-49:  Weak connection, surface-level match
- 0-19:   Irrelevant

Be precise. Differences in theme specificity matter."""


async def _score_one(client: AsyncOpenAI, essay_id: str, intent: dict, brief: dict) -> dict:
    user_content = (
        f"SEARCH INTENT:\n{json.dumps(intent, indent=2)}\n\n"
        f"ESSAY BRIEF (id: {essay_id}):\n{json.dumps(brief, indent=2)}"
    )
    try:
        resp = await client.chat.completions.create(
            model=RERANKER_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            # SiliconFlow: enable thinking for Qwen3 via extra_body
            extra_body={"enable_thinking": True},
            temperature=0.1,
            max_tokens=512,
        )
        content = resp.choices[0].message.content or "[]"
        # Strip <think>...</think> tags if model includes them
        import re
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        results = json.loads(content)
        if isinstance(results, list) and results:
            r = results[0]
            return {"id": essay_id, "score": int(r.get("score", 0)), "reason": r.get("reason", "")}
    except Exception:
        pass
    return {"id": essay_id, "score": 0, "reason": "scoring failed"}


async def score_relevance(intent: dict, briefs: list[dict]) -> list[dict]:
    """
    Reranks essays by relevance to the search intent.

    Args:
        intent: SearchIntent from the Parser agent
        briefs: list of { id, brief } dicts where brief is an InsightBrief

    Returns:
        list of { id, score, reason } sorted by score descending
    """
    client = _client()
    tasks = [
        _score_one(client, item["id"], intent, item["brief"])
        for item in briefs
        if item.get("brief")
    ]
    scores = await asyncio.gather(*tasks)
    return sorted(scores, key=lambda x: x["score"], reverse=True)
