# TrueDrafts Search Architecture

How a search query flows from the user's input to ranked results.

## Query Flow

```
User types query in EssaySearch
  → 600ms debounce
  → POST /api/vibe-search?q=...
      → parseVibeSearchQuery (Claude Haiku)
      → normalizeIntent (resolveUniversitySlug, resolveState, ...)
  → URL params set (vibe_q, vibe_themes, detected_uni_slug, detected_state, ...)
  → applications/page.tsx server component reads params
      → structured filters: universityId | ivyOnly | type | state | region | year
      → FTS filter: to_tsvector(...) @@ websearch_to_tsquery(...)
      → if sort=relevance: Anthropic re-ranks up to 180 results
  → ApplicationCard grid rendered
```

## Search Parameters

| Param | Set by | Used for |
|-------|--------|----------|
| `vibe_q` | EssaySearch | Raw query string, passed to Anthropic ranker |
| `q` | EssaySearch (parsed) | Semantic keywords for FTS |
| `vibe_themes` | EssaySearch (parsed) | Activity/theme tags for FTS |
| `detected_uni_slug` | EssaySearch (parsed) | Canonical slug from alias lookup |
| `detected_uni` | EssaySearch (legacy) | Raw AI text, fuzzy matched |
| `detected_major` | EssaySearch (parsed) | Major for FTS |
| `detected_years` | EssaySearch (parsed) | Year filter |
| `detected_state` | EssaySearch (parsed) | 2-letter state code |
| `detected_region` | EssaySearch (parsed) | northeast/south/midwest/west/mid_atlantic |
| `detected_type` | EssaySearch (parsed) | ivy/public_flagship/private_research/liberal_arts |
| `ivy` | EssaySearch (parsed) | Boolean: restrict to Ivy League |
| `university` | FilterSidebar | Exact slug from sidebar picker |
| `school_type` | FilterSidebar | Exact type from sidebar |
| `year` | FilterSidebar | Selected years (comma-separated) |
| `sort` | FilterSidebar | Sort order or "relevance" |

## University Aliases (`lib/university-lookup.ts`)

All nickname → slug mappings live in `UNIVERSITY_ALIAS_MAP`. Examples:
- `penn / upenn / wharton` → `upenn`
- `cal / berkeley / ucb` → `uc-berkeley`
- `vandy` → `vanderbilt`
- `nd / notre dame / fighting irish` → `notre-dame`
- `jhu / johns hopkins / hopkins` → `jhu`

To add an alias for a new university:
1. Add the slug to `UNIVERSITY_ALIAS_MAP` in `lib/university-lookup.ts`
2. Add the alias to the `aliases` array in `scripts/seed-universities.ts`
3. Run `npm run db:seed` to persist to DB

## AI Tagging (`lib/vibe-anthropic.ts`)

On application approval, `tagApplicationEssays()` extracts:
- `tone` — dominant voice (witty, vulnerable, analytical, …)
- `activities` — normalized to canonical vocabulary (debate, robotics, model_un, …)
- `themes` — topic tags (first_gen, STEM, immigration, …)
- `major` — inferred intended major
- `vibe_summary` — one-sentence search card description

The result is flattened into `vibeSearchText` by `buildVibeSearchText()`, which
includes both `underscore_form` and `space form` so both FTS and ILIKE match.

## Full-Text Search (PostgreSQL)

The FTS index covers `vibe_search_text || title || major`:

```sql
CREATE INDEX idx_college_apps_fts ON college_applications
USING GIN (
  to_tsvector('english',
    coalesce(vibe_search_text, '') || ' ' ||
    coalesce(title, '') || ' ' ||
    coalesce(major, '')
  )
);
```

Queries use `websearch_to_tsquery('english', ...)` which supports:
- Multi-word AND: `robotics debate` — documents must contain both
- OR: `robotics OR debate` — documents containing either (what we use for themes)
- Phrases: `"model un"` — exact phrase match
- Negation: `-sports` — exclude documents with "sports"

## Database Schema Changes

### universities table (new columns)
- `state text` — 2-letter US state abbreviation
- `city text` — City name
- `region text` — northeast | south | midwest | west | mid_atlantic
- `type text` — ivy | public_flagship | private_research | liberal_arts
- `aliases text[]` — searchable nickname array

### Indexes applied by `npm run db:indexes`
- `idx_college_apps_fts` — GIN FTS index (FTS queries)
- `idx_universities_aliases` — GIN array index (alias lookup)
- `idx_universities_state` — B-tree (state filter)
- `idx_universities_region` — B-tree (region filter)
- `idx_universities_type` — B-tree (type filter)

## Backfilling Existing Applications

After deploying, retag all approved applications to use the improved activity vocabulary:

```bash
curl -X POST /api/admin/retag \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

The `force: true` flag retags ALL approved applications (not just untagged ones).

## Query Examples

| User types | AI detects | Filter applied |
|------------|-----------|----------------|
| "penn debate essay" | target_uni_slug: upenn, activities: [debate] | universityId = upenn + FTS "debate" |
| "ivy league robotics" | ivy_league: true, activities: [robotics] | universityId IN ivies + FTS "robotics" |
| "california public school" | state: CA, university_type: public_flagship | state = CA + type = public_flagship |
| "cal essays" | target_uni_slug: uc-berkeley | universityId = uc-berkeley |
| "first gen MIT" | target_uni_slug: mit, themes: [first_gen] | universityId = mit + FTS "first_gen" |
| "midwest schools" | region: midwest | universityId IN midwest schools |
| "vulnerable immigrant story" | tone: vulnerable, themes: [immigration] | FTS "immigration" + Anthropic ranker |
