/**
 * University alias resolution: maps any nickname / abbreviation / colloquial name
 * to the canonical slug stored in the DB.
 *
 * Canonical slugs are defined in scripts/seed-universities.ts and must match
 * the `slug` column in the `universities` table.
 */

// ─── Alias map ────────────────────────────────────────────────────────────────

export const UNIVERSITY_ALIAS_MAP: Record<string, string> = {
  // ── Harvard ─────────────────────────────────────────────────────────────────
  harvard: "harvard",
  "harvard university": "harvard",
  crimson: "harvard",
  "h-bomb": "harvard",
  "the crimson": "harvard",

  // ── MIT ─────────────────────────────────────────────────────────────────────
  mit: "mit",
  "massachusetts institute of technology": "mit",
  "m.i.t.": "mit",
  "mit cambridge": "mit",

  // ── Stanford ─────────────────────────────────────────────────────────────────
  stanford: "stanford",
  "stanford university": "stanford",
  "the farm": "stanford",
  "leland stanford": "stanford",
  cardinal: "stanford",

  // ── Yale ─────────────────────────────────────────────────────────────────────
  yale: "yale",
  "yale university": "yale",
  elis: "yale",
  "the bulldogs": "yale",
  bulldog: "yale",

  // ── Princeton ────────────────────────────────────────────────────────────────
  princeton: "princeton",
  "princeton university": "princeton",
  tiger: "princeton",
  tigers: "princeton",
  "the tigers": "princeton",

  // ── Columbia ─────────────────────────────────────────────────────────────────
  columbia: "columbia",
  "columbia university": "columbia",
  "columbia university in the city of new york": "columbia",
  "columbia nyc": "columbia",
  "lions columbia": "columbia",

  // ── UPenn ────────────────────────────────────────────────────────────────────
  upenn: "upenn",
  penn: "upenn",
  "u penn": "upenn",
  "u of p": "upenn",
  "university of pennsylvania": "upenn",
  wharton: "upenn",
  "penn wharton": "upenn",
  "penn quakers": "upenn",
  quakers: "upenn",

  // ── Brown ────────────────────────────────────────────────────────────────────
  brown: "brown",
  "brown university": "brown",
  "brown bears": "brown",
  "bears brown": "brown",

  // ── Dartmouth ────────────────────────────────────────────────────────────────
  dartmouth: "dartmouth",
  "dartmouth college": "dartmouth",
  "big green": "dartmouth",
  "the big green": "dartmouth",
  "dartmouth green": "dartmouth",

  // ── Cornell ──────────────────────────────────────────────────────────────────
  cornell: "cornell",
  "cornell university": "cornell",
  "big red": "cornell",
  "the big red": "cornell",
  "cornell big red": "cornell",

  // ── Duke ─────────────────────────────────────────────────────────────────────
  duke: "duke",
  "duke university": "duke",
  "blue devils": "duke",
  "the blue devils": "duke",
  dukies: "duke",

  // ── Johns Hopkins ────────────────────────────────────────────────────────────
  jhu: "jhu",
  "johns hopkins": "jhu",
  "johns hopkins university": "jhu",
  "john hopkins": "jhu",
  hopkins: "jhu",
  "j hop": "jhu",
  "j-hop": "jhu",
  jhopkins: "jhu",
  "blue jays jhu": "jhu",

  // ── Northwestern ─────────────────────────────────────────────────────────────
  northwestern: "northwestern",
  "northwestern university": "northwestern",
  "nu northwestern": "northwestern",
  "wildcats northwestern": "northwestern",
  "north western": "northwestern",

  // ── Vanderbilt ───────────────────────────────────────────────────────────────
  vanderbilt: "vanderbilt",
  "vanderbilt university": "vanderbilt",
  vandy: "vanderbilt",
  dores: "vanderbilt",
  commodores: "vanderbilt",

  // ── Rice ─────────────────────────────────────────────────────────────────────
  rice: "rice",
  "rice university": "rice",
  owls: "rice",
  "the owls rice": "rice",

  // ── WashU ────────────────────────────────────────────────────────────────────
  washu: "washu",
  wustl: "washu",
  "wash u": "washu",
  "washington u": "washu",
  "washington university": "washu",
  "washington university in st. louis": "washu",
  "washington university st. louis": "washu",
  "washington university st louis": "washu",
  "wash u st louis": "washu",
  "washu st louis": "washu",
  "wustl st louis": "washu",

  // ── Notre Dame ───────────────────────────────────────────────────────────────
  "notre-dame": "notre-dame",
  "notre dame": "notre-dame",
  nd: "notre-dame",
  und: "notre-dame",
  "university of notre dame": "notre-dame",
  "fighting irish": "notre-dame",
  irish: "notre-dame",

  // ── Georgetown ───────────────────────────────────────────────────────────────
  georgetown: "georgetown",
  "georgetown university": "georgetown",
  gtown: "georgetown",
  hoyas: "georgetown",
  "g-town": "georgetown",

  // ── Emory ────────────────────────────────────────────────────────────────────
  emory: "emory",
  "emory university": "emory",
  eagles: "emory",

  // ── CMU ──────────────────────────────────────────────────────────────────────
  cmu: "cmu",
  "carnegie mellon": "cmu",
  "carnegie mellon university": "cmu",
  "carnegie-mellon": "cmu",
  "carnegie mellon u": "cmu",
  tartans: "cmu",

  // ── UMich ────────────────────────────────────────────────────────────────────
  umich: "umich",
  michigan: "umich",
  "u-m": "umich",
  "u of m": "umich",
  "university of michigan": "umich",
  wolverines: "umich",
  "go blue": "umich",

  // ── UC Berkeley ──────────────────────────────────────────────────────────────
  "uc-berkeley": "uc-berkeley",
  "uc berkeley": "uc-berkeley",
  berkeley: "uc-berkeley",
  cal: "uc-berkeley",
  ucb: "uc-berkeley",
  "golden bears": "uc-berkeley",
  "university of california berkeley": "uc-berkeley",
  "university of california at berkeley": "uc-berkeley",
  "cal bears": "uc-berkeley",

  // ── UCLA ─────────────────────────────────────────────────────────────────────
  ucla: "ucla",
  "uc los angeles": "ucla",
  "university of california los angeles": "ucla",
  "university of california at los angeles": "ucla",
  bruins: "ucla",
  westwood: "ucla",

  // ── UVA ──────────────────────────────────────────────────────────────────────
  uva: "uva",
  virginia: "uva",
  "university of virginia": "uva",
  wahoos: "uva",
  hoos: "uva",
  "u.va.": "uva",
  cav: "uva",
  cavs: "uva",
  cavaliers: "uva",

  // ── UNC ──────────────────────────────────────────────────────────────────────
  unc: "unc",
  "unc chapel hill": "unc",
  "unc-ch": "unc",
  "chapel hill": "unc",
  "university of north carolina": "unc",
  "university of north carolina at chapel hill": "unc",
  "tar heels": "unc",
  "north carolina": "unc",

  // ── USC ──────────────────────────────────────────────────────────────────────
  usc: "usc",
  "southern cal": "usc",
  "university of southern california": "usc",
  trojans: "usc",
  "sc trojans": "usc",

  // ── NYU ──────────────────────────────────────────────────────────────────────
  nyu: "nyu",
  "new york university": "nyu",
  "nyu new york": "nyu",
  violets: "nyu",

  // ── Boston College ───────────────────────────────────────────────────────────
  "boston-college": "boston-college",
  "boston college": "boston-college",
  bc: "boston-college",
  "the heights": "boston-college",
  "bc eagles": "boston-college",

  // ── Tufts ────────────────────────────────────────────────────────────────────
  tufts: "tufts",
  "tufts university": "tufts",
  jumbos: "tufts",
  jumbo: "tufts",

  // ── Wellesley ────────────────────────────────────────────────────────────────
  wellesley: "wellesley",
  "wellesley college": "wellesley",
  "wellesley blue": "wellesley",

  // ── Caltech ──────────────────────────────────────────────────────────────────
  caltech: "caltech",
  "cal tech": "caltech",
  "california institute of technology": "caltech",
  "caltech university": "caltech",
  beavers: "caltech",
  techers: "caltech",
};

// ─── State / region maps ──────────────────────────────────────────────────────

/** Maps common state names + colloquials → 2-letter abbreviation */
export const STATE_ALIAS_MAP: Record<string, string> = {
  california: "CA",
  "new york": "NY",
  nyc: "NY",
  massachusetts: "MA",
  connecticut: "CT",
  "rhode island": "RI",
  "new hampshire": "NH",
  pennsylvania: "PA",
  illinois: "IL",
  michigan: "MI",
  ohio: "OH",
  indiana: "IN",
  missouri: "MO",
  tennessee: "TN",
  texas: "TX",
  georgia: "GA",
  "north carolina": "NC",
  virginia: "VA",
  maryland: "MD",
  "washington dc": "DC",
  "washington d.c.": "DC",
  "district of columbia": "DC",
  dc: "DC",
};

/** Maps colloquial region names → canonical region used in DB */
export const REGION_ALIAS_MAP: Record<string, string> = {
  "new england": "northeast",
  northeast: "northeast",
  "north east": "northeast",
  "east coast": "northeast",
  "mid-atlantic": "mid_atlantic",
  midatlantic: "mid_atlantic",
  "mid atlantic": "mid_atlantic",
  south: "south",
  southeast: "south",
  "down south": "south",
  midwest: "midwest",
  "mid-west": "midwest",
  "mid west": "midwest",
  "west coast": "west",
  western: "west",
  west: "west",
  "bay area": "west",
  "pacific northwest": "west",
};

/** Maps school-type keywords → canonical type stored in DB */
export const TYPE_ALIAS_MAP: Record<string, string> = {
  ivy: "ivy",
  "ivy league": "ivy",
  ivies: "ivy",
  "ivy schools": "ivy",
  "public school": "public_flagship",
  "public university": "public_flagship",
  "public flagship": "public_flagship",
  "state school": "public_flagship",
  "state university": "public_flagship",
  flagship: "public_flagship",
  "private school": "private_research",
  "private university": "private_research",
  "private research": "private_research",
  "research university": "private_research",
  "liberal arts": "liberal_arts",
  "liberal arts college": "liberal_arts",
  lac: "liberal_arts",
};

// ─── Resolver functions ───────────────────────────────────────────────────────

/**
 * Resolve any university name/nickname/alias to its canonical slug.
 * Returns null if no match found.
 */
export function resolveUniversitySlug(input: string): string | null {
  if (!input?.trim()) return null;
  const key = input.toLowerCase().trim().replace(/\s+/g, " ");
  return UNIVERSITY_ALIAS_MAP[key] ?? null;
}

/**
 * Resolve a state name/abbreviation to a 2-letter code.
 * Pass-through for already-valid 2-letter codes.
 */
export function resolveState(input: string): string | null {
  if (!input?.trim()) return null;
  const trimmed = input.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return STATE_ALIAS_MAP[trimmed.toLowerCase()] ?? null;
}

/** Resolve a region phrase to canonical form. */
export function resolveRegion(input: string): string | null {
  if (!input?.trim()) return null;
  return REGION_ALIAS_MAP[input.toLowerCase().trim()] ?? null;
}

/** Resolve a school-type phrase to canonical form. */
export function resolveUniversityType(input: string): string | null {
  if (!input?.trim()) return null;
  return TYPE_ALIAS_MAP[input.toLowerCase().trim()] ?? null;
}

/**
 * Build a compact alias list for injecting into AI prompts.
 * Returns a short JSON string mapping common variants → slug.
 */
export function buildAliasPromptSnippet(): string {
  const compact: Record<string, string> = {
    "penn/upenn/wharton": "upenn",
    "cal/berkeley/ucb": "uc-berkeley",
    "mit": "mit",
    "cmu/carnegie mellon": "cmu",
    "vandy": "vanderbilt",
    "nd/notre dame": "notre-dame",
    "jhu/johns hopkins/hopkins": "jhu",
    "washu/wustl/wash u": "washu",
    "bc/boston college": "boston-college",
    "umich/michigan/u-m": "umich",
    "uva/virginia": "uva",
    "unc/carolina/chapel hill": "unc",
    "usc/southern cal/trojans": "usc",
    "nwu → northwestern": "northwestern",
    "gtown/hoyas → georgetown": "georgetown",
    "nu → northwestern": "northwestern",
  };
  return JSON.stringify(compact);
}
