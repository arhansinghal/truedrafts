"""
TrueDrafts AI Service
FastAPI microservice providing 3-agent search and insights pipeline.

Endpoints:
  GET  /health               — liveness check
  GET  /parse?q=...          — Parser agent (GLM-4.5-Air): query → SearchIntent
  POST /brief                — Insights agent (Qwen3): essay → InsightBrief (with DB cache)
  POST /rerank               — Reranker agent (Qwen3+CoT): rerank results by relevance
  POST /batch-tag            — Batch backfill insight briefs for all untagged essays
"""
from __future__ import annotations
import asyncio, json, logging, os, time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.parser   import parse_search_intent
from agents.insights import generate_application_brief
from agents.reranker import score_relevance
import db as database

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm DB connection pool on startup
    await database.get_pool()
    log.info("DB pool ready")
    yield
    # Cleanup
    if database._pool:
        await database._pool.close()


app = FastAPI(title="TrueDrafts AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ─── Request / Response models ────────────────────────────────────────────────

class BriefRequest(BaseModel):
    application_id: str
    essay_text:     str
    activities:     str = ""

class BriefResponse(BaseModel):
    application_id: str
    brief:          dict
    cached:         bool
    latency_ms:     int

class RerankItem(BaseModel):
    id:    str
    brief: dict

class RerankRequest(BaseModel):
    intent: dict
    items:  list[RerankItem]   # max 20

class BatchTagResponse(BaseModel):
    tagged:  int
    failed:  int
    total:   int
    elapsed: float


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "truedrafts-ai"}


@app.get("/parse")
async def parse(q: str = Query(..., min_length=1, max_length=500)):
    """
    Parser agent — GLM-4.5-Air.
    Converts a natural-language query into a structured SearchIntent.
    Target latency: <120ms.
    """
    t0 = time.monotonic()
    intent = await parse_search_intent(q.strip())
    ms = int((time.monotonic() - t0) * 1000)
    log.info("parse q=%r intent=%s latency=%dms", q, json.dumps(intent), ms)
    return {**intent, "latency_ms": ms}


@app.post("/brief", response_model=BriefResponse)
async def brief(req: BriefRequest):
    """
    Insights Generator agent — Qwen3-30B-A3B.
    Generates and caches an Insight Brief for an essay.
    Cache-hit path: ~5ms (DB read only).
    Cold path: ~800ms (Qwen3 inference).
    """
    t0 = time.monotonic()

    # Cache check first
    cached_brief = await database.get_brief(req.application_id)
    if cached_brief:
        return BriefResponse(
            application_id=req.application_id,
            brief=cached_brief,
            cached=True,
            latency_ms=int((time.monotonic() - t0) * 1000),
        )

    # Generate new brief
    generated = await generate_application_brief(req.essay_text, req.activities)
    if not generated:
        raise HTTPException(status_code=422, detail="Could not generate brief — essay too short or model error")

    # Cache in DB (fire-and-forget so we return fast)
    asyncio.create_task(database.save_brief(req.application_id, generated))

    return BriefResponse(
        application_id=req.application_id,
        brief=generated,
        cached=False,
        latency_ms=int((time.monotonic() - t0) * 1000),
    )


@app.post("/rerank")
async def rerank(req: RerankRequest):
    """
    Reranker agent — Qwen3-30B-A3B with internal Chain-of-Thought.
    Scores up to 20 essay briefs against the search intent.
    Runs in parallel; target latency: <1500ms for 10 items.
    """
    if len(req.items) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 items per rerank request")

    t0 = time.monotonic()
    items = [{"id": item.id, "brief": item.brief} for item in req.items]
    scores = await score_relevance(req.intent, items)
    ms = int((time.monotonic() - t0) * 1000)
    log.info("rerank %d items latency=%dms", len(items), ms)
    return {"scores": scores, "latency_ms": ms}


@app.post("/batch-tag", response_model=BatchTagResponse)
async def batch_tag():
    """
    Batch processor — backfills Insight Briefs for all approved essays
    that don't have one yet. Uses Qwen3-30B-A3B (same as /brief endpoint).
    Called manually from admin or on a cron schedule.
    No rate-limit delay needed (SiliconFlow has much higher limits than Gemini free tier).
    """
    t0 = time.monotonic()
    untagged = await database.get_untagged_applications()
    log.info("batch-tag: %d applications to process", len(untagged))

    tagged, failed = 0, 0

    async def process(item: dict):
        nonlocal tagged, failed
        if not item["essay_text"].strip():
            failed += 1
            return
        brief = await generate_application_brief(item["essay_text"])
        if brief:
            await database.save_brief(item["id"], brief)
            tagged += 1
            log.info("tagged %s", item["id"])
        else:
            failed += 1
            log.warning("failed %s", item["id"])

    # Process in batches of 5 concurrently to be polite to the API
    batch_size = 5
    for i in range(0, len(untagged), batch_size):
        batch = untagged[i:i + batch_size]
        await asyncio.gather(*[process(item) for item in batch])

    elapsed = time.monotonic() - t0
    log.info("batch-tag done: tagged=%d failed=%d elapsed=%.1fs", tagged, failed, elapsed)
    return BatchTagResponse(tagged=tagged, failed=failed, total=len(untagged), elapsed=elapsed)
