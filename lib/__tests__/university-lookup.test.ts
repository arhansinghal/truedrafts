import { describe, it, expect } from "vitest";
import {
  resolveUniversitySlug,
  resolveState,
  resolveRegion,
  resolveUniversityType,
  UNIVERSITY_ALIAS_MAP,
} from "../university-lookup";

describe("resolveUniversitySlug", () => {
  // Common short aliases
  it("resolves 'penn' → upenn", () => expect(resolveUniversitySlug("penn")).toBe("upenn"));
  it("resolves 'Penn' (mixed case) → upenn", () => expect(resolveUniversitySlug("Penn")).toBe("upenn"));
  it("resolves 'upenn' → upenn", () => expect(resolveUniversitySlug("upenn")).toBe("upenn"));
  it("resolves 'wharton' → upenn", () => expect(resolveUniversitySlug("wharton")).toBe("upenn"));
  it("resolves 'cal' → uc-berkeley", () => expect(resolveUniversitySlug("cal")).toBe("uc-berkeley"));
  it("resolves 'berkeley' → uc-berkeley", () => expect(resolveUniversitySlug("berkeley")).toBe("uc-berkeley"));
  it("resolves 'ucb' → uc-berkeley", () => expect(resolveUniversitySlug("ucb")).toBe("uc-berkeley"));
  it("resolves 'uc berkeley' → uc-berkeley", () => expect(resolveUniversitySlug("uc berkeley")).toBe("uc-berkeley"));
  it("resolves 'mit' → mit", () => expect(resolveUniversitySlug("mit")).toBe("mit"));
  it("resolves 'cmu' → cmu", () => expect(resolveUniversitySlug("cmu")).toBe("cmu"));
  it("resolves 'carnegie mellon' → cmu", () => expect(resolveUniversitySlug("carnegie mellon")).toBe("cmu"));
  it("resolves 'vandy' → vanderbilt", () => expect(resolveUniversitySlug("vandy")).toBe("vanderbilt"));
  it("resolves 'nd' → notre-dame", () => expect(resolveUniversitySlug("nd")).toBe("notre-dame"));
  it("resolves 'notre dame' → notre-dame", () => expect(resolveUniversitySlug("notre dame")).toBe("notre-dame"));
  it("resolves 'fighting irish' → notre-dame", () => expect(resolveUniversitySlug("fighting irish")).toBe("notre-dame"));
  it("resolves 'jhu' → jhu", () => expect(resolveUniversitySlug("jhu")).toBe("jhu"));
  it("resolves 'johns hopkins' → jhu", () => expect(resolveUniversitySlug("johns hopkins")).toBe("jhu"));
  it("resolves 'hopkins' → jhu", () => expect(resolveUniversitySlug("hopkins")).toBe("jhu"));
  it("resolves 'washu' → washu", () => expect(resolveUniversitySlug("washu")).toBe("washu"));
  it("resolves 'wustl' → washu", () => expect(resolveUniversitySlug("wustl")).toBe("washu"));
  it("resolves 'wash u' → washu", () => expect(resolveUniversitySlug("wash u")).toBe("washu"));
  it("resolves 'umich' → umich", () => expect(resolveUniversitySlug("umich")).toBe("umich"));
  it("resolves 'michigan' → umich", () => expect(resolveUniversitySlug("michigan")).toBe("umich"));
  it("resolves 'wolverines' → umich", () => expect(resolveUniversitySlug("wolverines")).toBe("umich"));
  it("resolves 'uva' → uva", () => expect(resolveUniversitySlug("uva")).toBe("uva"));
  it("resolves 'virginia' → uva", () => expect(resolveUniversitySlug("virginia")).toBe("uva"));
  it("resolves 'hoos' → uva", () => expect(resolveUniversitySlug("hoos")).toBe("uva"));
  it("resolves 'unc' → unc", () => expect(resolveUniversitySlug("unc")).toBe("unc"));
  it("resolves 'chapel hill' → unc", () => expect(resolveUniversitySlug("chapel hill")).toBe("unc"));
  it("resolves 'tar heels' → unc", () => expect(resolveUniversitySlug("tar heels")).toBe("unc"));
  it("resolves 'bc' → boston-college", () => expect(resolveUniversitySlug("bc")).toBe("boston-college"));
  it("resolves 'boston college' → boston-college", () => expect(resolveUniversitySlug("boston college")).toBe("boston-college"));
  it("resolves 'usc' → usc", () => expect(resolveUniversitySlug("usc")).toBe("usc"));
  it("resolves 'trojans' → usc", () => expect(resolveUniversitySlug("trojans")).toBe("usc"));
  it("resolves 'nyu' → nyu", () => expect(resolveUniversitySlug("nyu")).toBe("nyu"));
  it("resolves 'ucla' → ucla", () => expect(resolveUniversitySlug("ucla")).toBe("ucla"));
  it("resolves 'bruins' → ucla", () => expect(resolveUniversitySlug("bruins")).toBe("ucla"));
  it("resolves 'gtown' → georgetown", () => expect(resolveUniversitySlug("gtown")).toBe("georgetown"));
  it("resolves 'hoyas' → georgetown", () => expect(resolveUniversitySlug("hoyas")).toBe("georgetown"));
  it("resolves 'tufts' → tufts", () => expect(resolveUniversitySlug("tufts")).toBe("tufts"));
  it("resolves 'jumbos' → tufts", () => expect(resolveUniversitySlug("jumbos")).toBe("tufts"));
  it("resolves 'wellesley' → wellesley", () => expect(resolveUniversitySlug("wellesley")).toBe("wellesley"));

  // Unknown / null cases
  it("returns null for unknown input", () => expect(resolveUniversitySlug("oxford")).toBeNull());
  it("returns null for empty string", () => expect(resolveUniversitySlug("")).toBeNull());
  it("handles extra whitespace", () => expect(resolveUniversitySlug("  penn  ")).toBe("upenn"));

  // Ivy League schools
  it("resolves all 8 Ivy slugs to themselves", () => {
    const ivies = ["harvard", "yale", "princeton", "columbia", "upenn", "brown", "cornell", "dartmouth"];
    for (const slug of ivies) {
      expect(resolveUniversitySlug(slug)).toBe(slug);
    }
  });

  // Alias map values are all valid slugs
  it("all alias map values are known slugs from seed", () => {
    const knownSlugs = new Set(Object.values(UNIVERSITY_ALIAS_MAP));
    const expectedSlugs = [
      "harvard", "mit", "stanford", "yale", "princeton", "columbia", "upenn",
      "brown", "dartmouth", "cornell", "duke", "jhu", "northwestern", "vanderbilt",
      "rice", "washu", "notre-dame", "georgetown", "emory", "cmu", "umich",
      "uc-berkeley", "ucla", "uva", "unc", "usc", "nyu", "boston-college", "tufts", "wellesley",
    ];
    for (const slug of expectedSlugs) {
      expect(knownSlugs.has(slug)).toBe(true);
    }
  });
});

describe("resolveState", () => {
  it("passes through 2-letter codes", () => expect(resolveState("CA")).toBe("CA"));
  it("normalises lowercase 2-letter code", () => expect(resolveState("ca")).toBe("CA"));
  it("resolves 'california' → CA", () => expect(resolveState("california")).toBe("CA"));
  it("resolves 'new york' → NY", () => expect(resolveState("new york")).toBe("NY"));
  it("resolves 'massachusetts' → MA", () => expect(resolveState("massachusetts")).toBe("MA"));
  it("returns null for unknown state", () => expect(resolveState("england")).toBeNull());
  it("returns null for empty string", () => expect(resolveState("")).toBeNull());
});

describe("resolveRegion", () => {
  it("resolves 'new england' → northeast", () => expect(resolveRegion("new england")).toBe("northeast"));
  it("resolves 'west coast' → west", () => expect(resolveRegion("west coast")).toBe("west"));
  it("resolves 'midwest' → midwest", () => expect(resolveRegion("midwest")).toBe("midwest"));
  it("resolves 'south' → south", () => expect(resolveRegion("south")).toBe("south"));
  it("resolves 'mid-atlantic' → mid_atlantic", () => expect(resolveRegion("mid-atlantic")).toBe("mid_atlantic"));
  it("returns null for unknown region", () => expect(resolveRegion("europe")).toBeNull());
});

describe("resolveUniversityType", () => {
  it("resolves 'ivy league' → ivy", () => expect(resolveUniversityType("ivy league")).toBe("ivy"));
  it("resolves 'ivies' → ivy", () => expect(resolveUniversityType("ivies")).toBe("ivy"));
  it("resolves 'public school' → public_flagship", () => expect(resolveUniversityType("public school")).toBe("public_flagship"));
  it("resolves 'state school' → public_flagship", () => expect(resolveUniversityType("state school")).toBe("public_flagship"));
  it("resolves 'liberal arts' → liberal_arts", () => expect(resolveUniversityType("liberal arts")).toBe("liberal_arts"));
  it("returns null for unknown type", () => expect(resolveUniversityType("community college")).toBeNull());
});
