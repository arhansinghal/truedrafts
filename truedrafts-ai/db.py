"""
Database utilities — async read/write for insight brief caching.
Uses asyncpg directly (no ORM) for speed.
"""
from __future__ import annotations
import asyncpg, json, os
from typing import Any

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=os.environ["DATABASE_URL"],
            min_size=2,
            max_size=10,
            ssl="require",
        )
    return _pool


async def get_brief(application_id: str) -> dict | None:
    """Returns cached insight_brief for an application, or None."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT insight_brief FROM college_applications WHERE id = $1",
        application_id,
    )
    if row and row["insight_brief"]:
        try:
            return json.loads(row["insight_brief"])
        except Exception:
            return None
    return None


async def save_brief(application_id: str, brief: dict) -> None:
    """Persists an insight brief to the database."""
    pool = await get_pool()
    await pool.execute(
        "UPDATE college_applications SET insight_brief = $1 WHERE id = $2",
        json.dumps(brief),
        application_id,
    )


async def get_untagged_applications(limit: int = 500) -> list[dict]:
    """
    Returns all approved applications that are missing an insight_brief.
    Used by the batch processor.
    """
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, common_app_content, supplementals
        FROM college_applications
        WHERE status = 'approved'
          AND (insight_brief IS NULL OR insight_brief = '')
        LIMIT $1
        """,
        limit,
    )
    result = []
    for row in rows:
        supplementals_text = ""
        try:
            sups = json.loads(row["supplementals"] or "[]")
            supplementals_text = "\n\n".join(
                s.get("content", "") for s in sups if s.get("content")
            )
        except Exception:
            pass

        essay_text = "\n\n".join(filter(None, [
            row["common_app_content"] or "",
            supplementals_text,
        ]))
        result.append({"id": str(row["id"]), "essay_text": essay_text})
    return result
