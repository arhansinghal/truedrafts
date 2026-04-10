# TrueDrafts AI Service

FastAPI microservice powering the 3-agent AI pipeline for TrueDrafts search and insights.

## Architecture

```
User types query
     │
     ▼
/parse  (GLM-4.5-Air, ~100ms)
     │  SearchIntent { tones, themes, target_uni, semantic_keywords }
     ▼
Neon PostgreSQL ILIKE search on vibeSearchText
     │  Top-30 results with cached InsightBriefs
     ▼
/rerank  (Qwen3-30B-A3B + CoT, ~1s for top-10)
     │  Re-sorted by true relevance
     ▼
Browser renders cards with AI Insight Briefs
```

Briefs are generated **once at essay approval** via `/brief` (Qwen3-30B-A3B) and cached in the `insight_brief` DB column. Subsequent reads cost 0 AI tokens.

## Models (via SiliconFlow)

| Agent | Model | Role | Cost |
|---|---|---|---|
| Parser | `THUDM/GLM-4.5-Air` | Query → SearchIntent | ~$0.0001/call |
| Insights | `Qwen/Qwen3-30B-A3B` | Essay → InsightBrief | ~$0.001/essay |
| Reranker | `Qwen/Qwen3-30B-A3B` + CoT | Brief → relevance score | ~$0.002/10 items |

## Setup

### 1. Get SiliconFlow API key
Sign up at [siliconflow.cn](https://siliconflow.cn) → API Keys → Create key.
Free tier: 14M tokens/day for most models.

### 2. Install dependencies
```bash
cd truedrafts-ai
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your keys
```

Required vars:
- `SILICONFLOW_API_KEY` — from siliconflow.cn
- `DATABASE_URL` — same Neon connection string as Next.js
- `ALLOWED_ORIGINS` — comma-separated allowed CORS origins

### 4. Run DB migration
The `insight_brief` column was added to `college_applications`. Apply via Drizzle from the Next.js project:
```bash
cd ..   # back to TrueDrafts root
npx drizzle-kit migrate
```
Or run this SQL directly in Neon console:
```sql
ALTER TABLE college_applications ADD COLUMN IF NOT EXISTS insight_brief text;
```

### 5. Start the service
```bash
# Development
uvicorn main:app --reload --port 8000

# Production
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Endpoints

### `GET /health`
Liveness check.
```bash
curl http://localhost:8000/health
# → {"status":"ok","service":"truedrafts-ai"}
```

### `GET /parse?q=<query>`
Parser agent — converts query to SearchIntent.
```bash
curl "http://localhost:8000/parse?q=resilient+first-gen+student+Yale"
# → {"tones":["determined","earnest"],"themes":["first-gen","resilience"],"target_uni":"Yale","semantic_keywords":"first-gen resilience family Yale","latency_ms":98}
```

### `POST /brief`
Generates and caches an Insight Brief for an essay.
```bash
curl -X POST http://localhost:8000/brief \
  -H "Content-Type: application/json" \
  -d '{"application_id":"uuid-here","essay_text":"I built a robot that...","activities":"Robotics captain"}'
# → {"application_id":"...","brief":{...},"cached":false,"latency_ms":812}
```

### `POST /rerank`
Reranks up to 20 essays by relevance to search intent.
```bash
curl -X POST http://localhost:8000/rerank \
  -H "Content-Type: application/json" \
  -d '{"intent":{...},"items":[{"id":"abc","brief":{...}}]}'
# → {"scores":[{"id":"abc","score":87,"reason":"Strong thematic match on robotics and failure"}],"latency_ms":1043}
```

### `POST /batch-tag`
Backfills Insight Briefs for all approved essays missing one. Run manually or on a schedule.
```bash
curl -X POST http://localhost:8000/batch-tag
# → {"tagged":31,"failed":2,"total":33,"elapsed":47.3}
```

## Backfilling Existing Essays

```bash
# Run once after deployment to tag all existing essays
curl -X POST https://your-service.fly.dev/batch-tag
```
Processes 5 essays concurrently. No rate limit delay needed (SiliconFlow has 500 RPM+).
Expect ~2s per essay → 33 essays ≈ 15 seconds.

## Performance Testing (Locust)

```bash
# Install locust (already in requirements.txt)
# Start the AI service first, then:
locust -f tests/locustfile.py --host=http://localhost:8000 \
       --users=20 --spawn-rate=5

# Open http://localhost:8089 for the web dashboard

# Headless 60-second load test with CSV output:
locust -f tests/locustfile.py --host=http://localhost:8000 \
       --users=50 --spawn-rate=10 --run-time=60s --headless \
       --csv=results/load_test
```

Target latencies (p95):
- `/parse`: < 120ms
- `/brief` (cached): < 30ms
- `/brief` (cold): < 1500ms
- `/rerank` (10 items): < 2000ms

## A/B Testing

Compares Hybrid Search (Parser + ILIKE + Reranker) vs plain text ILIKE.

```bash
# Run against your Neon DB and local AI service
python -m tests.ab_test \
  --db "postgresql://..." \
  --ai "http://localhost:8000" \
  --output results/ab_$(date +%Y%m%d).json
```

Output includes nDCG scores per query and aggregate improvement percentage.

## Deploying to Fly.io (Recommended)

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --name truedrafts-ai --region ord
fly secrets set SILICONFLOW_API_KEY=sk-... DATABASE_URL=postgresql://...
fly secrets set ALLOWED_ORIGINS=https://truedrafts.vercel.app
fly deploy
```

Then add to Vercel:
```
AI_SERVICE_URL=https://truedrafts-ai.fly.dev
```

## Connecting to Next.js

The Next.js app (`app/api/vibe-search/route.ts`) already calls the Python service when `AI_SERVICE_URL` env var is set. Add it to Vercel:

1. Vercel Dashboard → Project → Settings → Environment Variables
2. Add `AI_SERVICE_URL` = `https://your-service.fly.dev`

Without `AI_SERVICE_URL` set, the app falls back to Gemini automatically.
