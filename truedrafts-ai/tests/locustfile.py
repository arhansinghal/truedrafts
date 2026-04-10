"""
Locust performance test for TrueDrafts AI Service.

Measures:
  - /parse    — Parser agent latency (target: <120ms p95)
  - /brief    — Insight Brief latency, cache-hit vs cold (target: <50ms p95 cached)
  - /rerank   — Reranker latency for 5 items (target: <1500ms p95)

Run:
  pip install locust
  locust -f tests/locustfile.py --host=http://localhost:8000 --users=20 --spawn-rate=5
  # Then open http://localhost:8089 for the web dashboard

Or headless:
  locust -f tests/locustfile.py --host=http://localhost:8000 \
         --users=50 --spawn-rate=10 --run-time=60s --headless \
         --csv=results/load_test
"""
import json, random
from locust import HttpUser, task, between, events

SAMPLE_QUERIES = [
    "resilient first-gen student for Yale",
    "funny essay about failure and redemption",
    "analytical STEM essay MIT engineering",
    "immigrant family Harvard vulnerable",
    "chess national champion leadership Penn",
    "robotics competition emotional journey",
    "community service poverty awareness Stanford",
    "artistic creative writing Princeton",
    "overcoming learning disability earnest",
    "athletic injury comeback determined",
]

SAMPLE_BRIEFS = [
    {
        "essay_focus": "Overcoming a failed robotics competition to build a better team",
        "applicant_profile": "3x FIRST Robotics regional winner, STEM tutor, chess club president",
        "why_it_worked": "Shows intellectual humility and iterative problem-solving under pressure",
        "tone_signature": "Analytically vulnerable, quietly determined",
        "standout_quote": "Our robot failed in 8 seconds. My leadership had been failing for months.",
    },
    {
        "essay_focus": "First-generation student navigating cultural identity between two worlds",
        "applicant_profile": "Valedictorian, debate team captain, community ESL tutor",
        "why_it_worked": "Demonstrates maturity and empathy beyond age through concrete storytelling",
        "tone_signature": "Earnest, reflective, quietly proud",
        "standout_quote": "I translate more than language — I translate expectations.",
    },
]

SAMPLE_ESSAY = """
The summer I turned sixteen, I built a robot that couldn't walk. I had spent six months
designing its legs — four elegant carbon fiber limbs, each with three degrees of freedom —
and on competition day, it collapsed in 8 seconds. The judges moved on. My team moved on.
I couldn't.

What followed was not the productive failure narrative you might expect. I was angry, then
embarrassed, then obsessively analytical. I printed out every sensor reading, every torque
calculation, and spread them across my bedroom floor like a crime scene. The problem wasn't
the robot. The problem was my certainty. I had been so confident in my simulation results
that I never adequately tested the actual hardware. Simulation is clean. Reality has friction.

This is the lesson I keep learning: the gap between model and reality is where real engineering
happens. I've since rebuilt that robot twice, and it now walks — awkwardly, beautifully,
exactly like something real.
"""


class AIServiceUser(HttpUser):
    wait_time = between(0.5, 2)

    @task(5)
    def parse_query(self):
        """Most frequent operation — should be sub-120ms."""
        q = random.choice(SAMPLE_QUERIES)
        with self.client.get(f"/parse?q={q}", catch_response=True, name="/parse") as resp:
            if resp.status_code != 200:
                resp.failure(f"status={resp.status_code}")
                return
            data = resp.json()
            if "semantic_keywords" not in data:
                resp.failure("missing semantic_keywords")
            else:
                latency = data.get("latency_ms", 0)
                if latency > 300:
                    resp.failure(f"too slow: {latency}ms")

    @task(2)
    def get_brief_cached(self):
        """Cache-hit path — reads from DB, should be <50ms."""
        # Use a known application_id that already has a brief cached
        # In real tests, seed this with actual IDs from your DB
        app_id = "00000000-0000-0000-0000-000000000001"
        payload = {
            "application_id": app_id,
            "essay_text": SAMPLE_ESSAY,
            "activities": "Robotics, Chess, STEM tutoring",
        }
        with self.client.post("/brief", json=payload, catch_response=True, name="/brief (cached)") as resp:
            if resp.status_code not in (200, 422):
                resp.failure(f"status={resp.status_code}")

    @task(1)
    def get_brief_cold(self):
        """Cold path — AI inference, target <1000ms."""
        import uuid
        payload = {
            "application_id": str(uuid.uuid4()),
            "essay_text": SAMPLE_ESSAY,
            "activities": "National debate team, community organizer",
        }
        with self.client.post("/brief", json=payload, catch_response=True, name="/brief (cold)") as resp:
            if resp.status_code == 200:
                data = resp.json()
                if data.get("latency_ms", 0) > 2000:
                    resp.failure(f"too slow: {data['latency_ms']}ms")
            elif resp.status_code != 422:
                resp.failure(f"status={resp.status_code}")

    @task(1)
    def rerank_results(self):
        """Reranker — parallel CoT scoring, target <2000ms for 5 items."""
        intent = {
            "tones": ["determined", "analytical"],
            "themes": ["robotics", "failure", "engineering"],
            "target_uni": "MIT",
            "semantic_keywords": "robotics failure engineering growth",
        }
        items = [
            {"id": f"app-{i}", "brief": random.choice(SAMPLE_BRIEFS)}
            for i in range(5)
        ]
        with self.client.post(
            "/rerank",
            json={"intent": intent, "items": items},
            catch_response=True,
            name="/rerank (5 items)",
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"status={resp.status_code}")


@events.quitting.add_listener
def print_summary(environment, **kwargs):
    stats = environment.stats
    print("\n=== LATENCY SUMMARY ===")
    for name, s in stats.entries.items():
        print(f"  {name[1]:30s}  p50={s.get_response_time_percentile(0.5):.0f}ms  "
              f"p95={s.get_response_time_percentile(0.95):.0f}ms  "
              f"p99={s.get_response_time_percentile(0.99):.0f}ms  "
              f"fail={s.num_failures}")
