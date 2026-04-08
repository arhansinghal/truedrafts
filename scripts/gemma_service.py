"""
TrueDrafts — Vibe Search Intelligence Layer
FastAPI service powered by Gemma 4 (April 2026).

Install:
    pip install fastapi uvicorn google-genai

Run:
    GEMINI_API_KEY=your_key uvicorn scripts.gemma_service:app --port 8000 --reload

Next.js calls this service via:
    POST http://localhost:8000/tag        (on essay approval)
    POST http://localhost:8000/search     (on search bar submit)
    POST http://localhost:8000/trending   (for search bar recommendations)
"""

import json
import os
import re
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# SDK client
# ---------------------------------------------------------------------------

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# Gemma 4 model IDs (April 2026)
TAGGER_MODEL = "gemma-4-31b-it"          # deep analysis, thinking mode
PARSER_MODEL  = "gemma-4-26b-a4b-it"     # MoE variant — low latency for real-time parsing

app = FastAPI(title="TrueDrafts Vibe Search Service")


# ---------------------------------------------------------------------------
# Pydantic schemas (request / response)
# ---------------------------------------------------------------------------

class TagRequest(BaseModel):
    essay_id: str
    text: str

class EssayMetadata(BaseModel):
    tone: str
    core_values: list[str]
    narrative_arc: str
    vibe_summary: str

class SearchRequest(BaseModel):
    query: str

class SearchIntent(BaseModel):
    tones: list[str]
    target_uni: Optional[str]
    semantic_keywords: str

class TrendingRequest(BaseModel):
    # List of metadata objects already stored in your DB
    metadata_rows: list[dict]

class VibeCombo(BaseModel):
    name: str
    description: str
    example_tones: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict:
    """
    Pull the first valid JSON object out of a model response.
    Gemma 4 Thinking Mode emits reasoning before the JSON block;
    this strips it regardless of whether the model uses <think> tags
    or plain prose.
    """
    # Remove <think>...</think> blocks if present
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    # Find the first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in model output:\n{text[:300]}")
    return json.loads(match.group())


def _build_thinking_config(level: str = "high") -> types.ThinkingConfig:
    """
    Gemma 4 native Thinking Mode config.
    level: "low" | "medium" | "high"
    """
    return types.ThinkingConfig(thinking_level=level)


# ---------------------------------------------------------------------------
# 1. TAGGING ENGINE  —  POST /tag
# ---------------------------------------------------------------------------

TAGGER_PROMPT = """You are an expert college admissions essay analyst.

Analyse the essay below and return ONLY a JSON object with these fields:
  "tone"           – single dominant tone word (e.g. witty, vulnerable, analytical, earnest, urgent)
  "core_values"    – list of 2–4 character traits the writer demonstrates (e.g. resilience, intellectual_curiosity, empathy)
  "narrative_arc"  – one of: hero's_journey | internal_realization | slice_of_life | problem_solution | before_after
  "vibe_summary"   – one punchy sentence (≤20 words) describing the essay's feel for a search result card

Output ONLY the JSON object. No explanation, no markdown fences.

ESSAY:
{essay_text}"""


@app.post("/tag", response_model=EssayMetadata)
def tag_essay(req: TagRequest) -> EssayMetadata:
    """
    Deep-analyse an essay and return structured vibe metadata.
    Called once on essay approval — result is stored in your DB.
    """
    prompt = TAGGER_PROMPT.format(essay_text=req.text)

    try:
        response = client.models.generate_content(
            model=TAGGER_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                thinking_config=_build_thinking_config("high"),
                temperature=0.2,
                max_output_tokens=1024,
                response_mime_type="application/json",
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemma 4 tagging error: {e}")

    try:
        data = _extract_json(response.text)
        return EssayMetadata(**data)
    except (ValueError, KeyError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"JSON parse error: {e}\nRaw: {response.text[:400]}")


# ---------------------------------------------------------------------------
# 2. SEARCH INTENT PARSER  —  POST /search
# ---------------------------------------------------------------------------

PARSER_PROMPT = """You are a search intent classifier for a college essay marketplace.

Convert the user's search query into a JSON object with these fields:
  "tones"             – list of tone words (e.g. ["witty", "analytical"]). Map casual words:
                        funny→witty, sad→vulnerable, nerdy→analytical, inspiring→uplifting
  "target_uni"        – university name if mentioned, otherwise null
  "semantic_keywords" – 3–6 word phrase capturing the core vibe for vector search

Output ONLY the JSON object. No explanation.

Query: "{query}"
"""


@app.post("/search", response_model=SearchIntent)
def parse_search(req: SearchRequest) -> SearchIntent:
    """
    Real-time query parser. Called on every search bar submission.
    Uses the fast MoE variant to keep latency under ~300ms.
    """
    prompt = PARSER_PROMPT.format(query=req.query)

    try:
        response = client.models.generate_content(
            model=PARSER_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                # No thinking mode here — speed matters for real-time search
                temperature=0.1,
                max_output_tokens=256,
                response_mime_type="application/json",
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemma 4 parser error: {e}")

    try:
        data = _extract_json(response.text)
        return SearchIntent(**data)
    except (ValueError, KeyError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"JSON parse error: {e}\nRaw: {response.text[:400]}")


# ---------------------------------------------------------------------------
# 3. TRENDING VIBE RECOMMENDATIONS  —  POST /trending
# ---------------------------------------------------------------------------

TRENDING_PROMPT = """You are analysing essay metadata for a college essay marketplace.

Below is a JSON array of essay metadata objects (each has tone, core_values, narrative_arc).
Identify the 3–5 most common "vibe combinations" across these essays and give each a catchy name.

Return ONLY a JSON array of objects, each with:
  "name"          – catchy label like "The 'Quiet Revolutionary' Vibe"
  "description"   – one sentence explaining the pattern
  "example_tones" – 2–3 tone words that define it

No explanation, no markdown. Output ONLY the JSON array.

METADATA:
{metadata_json}
"""


@app.post("/trending", response_model=list[VibeCombo])
def get_trending_vibes(req: TrendingRequest) -> list[VibeCombo]:
    """
    Analyse existing essay metadata and surface trending vibe combos
    for the search bar recommendations dropdown.
    Uses Thinking Mode to reason across the full dataset before naming patterns.
    """
    if not req.metadata_rows:
        return []

    # Send up to 500 rows — Gemma 4's 256K context handles this easily
    metadata_json = json.dumps(req.metadata_rows[:500], indent=2)
    prompt = TRENDING_PROMPT.format(metadata_json=metadata_json)

    try:
        response = client.models.generate_content(
            model=TAGGER_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                thinking_config=_build_thinking_config("medium"),
                temperature=0.4,
                max_output_tokens=1024,
                response_mime_type="application/json",
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemma 4 trending error: {e}")

    try:
        text = re.sub(r"<think>.*?</think>", "", response.text, flags=re.DOTALL)
        # Response is an array, not an object
        arr_match = re.search(r"\[.*\]", text, re.DOTALL)
        if not arr_match:
            raise ValueError("No JSON array found")
        combos = json.loads(arr_match.group())
        return [VibeCombo(**c) for c in combos]
    except (ValueError, KeyError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"JSON parse error: {e}\nRaw: {response.text[:400]}")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "tagger": TAGGER_MODEL, "parser": PARSER_MODEL}
