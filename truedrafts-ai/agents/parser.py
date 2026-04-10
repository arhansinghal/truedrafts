"""
THE PARSER — llama-3.1-8b-instant via Groq
Converts a natural-language search query into a structured SearchIntent object.
Free tier: 14,400 req/day. Fastest inference available.
"""
from __future__ import annotations
import json, os, re
from openai import AsyncOpenAI

GROQ_BASE    = "https://api.groq.com/openai/v1"
PARSER_MODEL = "llama-3.1-8b-instant"

_TONE_ALIASES = {
    "funny": "witty", "humorous": "witty", "sad": "vulnerable",
    "emotional": "vulnerable", "logical": "analytical", "academic": "analytical",
    "passionate": "earnest", "sincere": "earnest", "exciting": "urgent",
    "serious": "determined", "hopeful": "hopeful", "thoughtful": "reflective",
}

SYSTEM_PROMPT = """You are a search intent parser for a college essay marketplace.
Convert user queries into a strict JSON object. No markdown, no explanation — only JSON.

Schema:
{
  "tones": ["witty"|"vulnerable"|"analytical"|"earnest"|"urgent"|"reflective"|"determined"|"hopeful"],
  "themes": ["specific topic tags, 2-6 items, e.g. robotics, chess, immigration, first-gen"],
  "target_uni": "university name or null",
  "semantic_keywords": "3-6 word phrase capturing the essence of the search"
}

Rules:
- tones must be from the allowed list (map similar words: funny→witty, sad→vulnerable)
- themes should be specific concrete nouns, not generic (robotics not technology)
- target_uni: full name if mentioned (Yale, not yale), null if not mentioned
- semantic_keywords: distilled essence of what buyer is looking for"""


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=os.environ["GROQ_API_KEY"],
        base_url=GROQ_BASE,
    )


async def parse_search_intent(query: str) -> dict:
    """
    Returns a SearchIntent dict:
      { tones, themes, target_uni, semantic_keywords }
    Falls back to minimal intent if model fails.
    """
    client = _client()
    try:
        resp = await client.chat.completions.create(
            model=PARSER_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": f"Parse this query: {query}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=256,
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)

        # Normalise tones through alias map
        tones = [_TONE_ALIASES.get(t, t) for t in data.get("tones", [])]
        valid_tones = {"witty","vulnerable","analytical","earnest","urgent","reflective","determined","hopeful"}
        tones = [t for t in tones if t in valid_tones]

        return {
            "tones":             tones,
            "themes":            data.get("themes", []),
            "target_uni":        data.get("target_uni"),
            "semantic_keywords": data.get("semantic_keywords", query),
        }
    except Exception as exc:
        # Graceful fallback — never block a search
        return {"tones": [], "themes": [], "target_uni": None, "semantic_keywords": query}
