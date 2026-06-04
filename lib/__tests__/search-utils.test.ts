import { describe, it, expect } from "vitest";
import { buildVibeSearchText } from "../vibe-anthropic";
import type { EssayVibeMetadata } from "../vibe-anthropic";

const BASE_META: EssayVibeMetadata = {
  tone: "determined",
  core_values: ["resilience", "intellectual_curiosity"],
  narrative_arc: "hero's_journey",
  vibe_summary: "A robotics student finds her voice through code.",
  themes: ["robotics", "STEM", "leadership"],
  major: "Computer Science",
  activities: ["robotics", "debate", "model_un"],
};

describe("buildVibeSearchText", () => {
  it("includes major", () => {
    expect(buildVibeSearchText(BASE_META)).toContain("computer science");
  });

  it("includes activities", () => {
    const text = buildVibeSearchText(BASE_META);
    expect(text).toContain("robotics");
    expect(text).toContain("debate");
    expect(text).toContain("model_un");
  });

  it("expands underscored activities to space form", () => {
    const text = buildVibeSearchText(BASE_META);
    // model_un should appear as both "model_un" and "model un"
    expect(text).toContain("model_un");
    expect(text).toContain("model un");
  });

  it("expands underscored themes", () => {
    const meta: EssayVibeMetadata = {
      ...BASE_META,
      themes: ["first_gen", "stem"],
    };
    const text = buildVibeSearchText(meta);
    expect(text).toContain("first_gen");
    expect(text).toContain("first gen");
  });

  it("includes tone", () => {
    expect(buildVibeSearchText(BASE_META)).toContain("determined");
  });

  it("includes narrative arc (spaces form)", () => {
    const text = buildVibeSearchText(BASE_META);
    expect(text).toContain("hero's journey");
  });

  it("includes vibe_summary", () => {
    expect(buildVibeSearchText(BASE_META)).toContain("robotics student");
  });

  it("is lowercase", () => {
    const text = buildVibeSearchText(BASE_META);
    expect(text).toBe(text.toLowerCase());
  });

  it("handles null major gracefully", () => {
    const meta = { ...BASE_META, major: null };
    expect(() => buildVibeSearchText(meta)).not.toThrow();
  });

  it("handles empty arrays gracefully", () => {
    const meta: EssayVibeMetadata = {
      ...BASE_META,
      activities: [],
      themes: [],
      core_values: [],
    };
    expect(() => buildVibeSearchText(meta)).not.toThrow();
  });

  it("non-underscored terms appear as-is without space expansion", () => {
    const meta: EssayVibeMetadata = {
      ...BASE_META,
      activities: ["robotics"], // no underscore → no extra expansion
      themes: [],
      vibe_summary: "A student.",
    };
    const text = buildVibeSearchText(meta);
    // "robotics" appears exactly once (from activities only; no duplication)
    expect(text.split("robotics").length - 1).toBe(1);
  });
});

describe("buildAliasPromptSnippet", () => {
  it("returns valid JSON string", async () => {
    const { buildAliasPromptSnippet } = await import("../university-lookup");
    const snippet = buildAliasPromptSnippet();
    expect(() => JSON.parse(snippet)).not.toThrow();
  });

  it("contains key aliases", async () => {
    const { buildAliasPromptSnippet } = await import("../university-lookup");
    const snippet = buildAliasPromptSnippet();
    expect(snippet).toContain("upenn");
    expect(snippet).toContain("uc-berkeley");
  });
});
