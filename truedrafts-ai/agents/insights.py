"""
THE INSIGHTS GENERATOR — llama-3.3-70b-versatile via Groq
Generates a structured Insight Brief for a college essay.
Called once at approval time; result cached in `insight_brief` DB column.
Free tier: 14,400 req/day.
"""
from __future__ import annotations
import json, os
from openai import AsyncOpenAI

GROQ_BASE      = "https://api.groq.com/openai/v1"
INSIGHTS_MODEL = "llama-3.3-70b-versatile"

_client_cache: AsyncOpenAI | None = None


def _client() -> AsyncOpenAI:
    global _client_cache
    if _client_cache is None:
        _client_cache = AsyncOpenAI(
            api_key=os.environ["GROQ_API_KEY"],
            base_url=GROQ_BASE,
        )
    return _client_cache


SYSTEM_PROMPT = """You are an expert college admissions analyst. Given essay text (and optional activity list), produce a concise JSON Insight Brief that helps a prospective buyer quickly understand the essay's value.

Return ONLY valid JSON — no markdown, no explanation.

Schema:
{
  "essay_focus": "One sentence: the central story or argument of the essay (≤20 words)",
  "applicant_profile": "One sentence: the student's notable activities, awards, or background (≤25 words)",
  "why_it_worked": "One sentence: why this essay is effective for admissions (≤20 words)",
  "tone_signature": "2-4 word description of the essay's voice (e.g. 'Quietly determined, self-aware')",
  "standout_quote": "The single most memorable sentence from the essay (exact quote, ≤30 words)"
}

Be specific, not generic. Mention actual details from the essay."""


async def generate_application_brief(essay_text: str, activities: str = "") -> dict | None:
    """
    Generates an Insight Brief for the given essay text.
    activities: optional free-text list of extracurriculars / awards.
    Returns the brief dict, or None on failure.
    """
    if not essay_text or len(essay_text.strip()) < 100:
        return None

    user_content = f"ESSAY:\n{essay_text[:6000]}"
    if activities:
        user_content += f"\n\nACTIVITIES / PROFILE:\n{activities[:1000]}"

    client = _client()
    try:
        resp = await client.chat.completions.create(
            model=INSIGHTS_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=512,
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)

        # Validate required keys are present
        required = {"essay_focus", "applicant_profile", "why_it_worked", "tone_signature", "standout_quote"}
        if not required.issubset(data.keys()):
            return None

        return data
    except Exception:
        return None
