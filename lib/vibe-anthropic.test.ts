import { describe, it, expect } from "vitest";
import { buildVibeSearchText, type EssayVibeMetadata } from "./vibe-anthropic";

/**
 * Regression: AI tagging can return metadata without a `narrative_arc` field
 * (tagApplicationEssays only requires tone + vibe_summary). buildVibeSearchText
 * used to call .replace() on that missing value and throw a TypeError, taking
 * down the whole search-text build.
 */
describe("buildVibeSearchText", () => {
  it("does not throw when narrative_arc is missing, and still includes the other fields", () => {
    const meta = {
      tone: "reflective",
      vibe_summary: "A robotics story",
      themes: [],
      core_values: [],
      activities: [],
      major: null,
      // narrative_arc intentionally omitted — model output can drop it
    } as unknown as EssayVibeMetadata;

    let result: string | undefined;
    expect(() => {
      result = buildVibeSearchText(meta);
    }).not.toThrow();

    expect(result).toBe("reflective a robotics story");
  });

  it("still expands underscores in narrative_arc when it is present", () => {
    const meta: EssayVibeMetadata = {
      tone: "determined",
      core_values: ["intellectual_curiosity"],
      narrative_arc: "internal_realization",
      vibe_summary: "Built a robot, found a voice",
      themes: ["first_gen"],
      major: "Computer Science",
      activities: ["model_un"],
    };

    const result = buildVibeSearchText(meta);

    expect(result).toBe(
      "computer science model_un model un determined first_gen first gen intellectual_curiosity intellectual curiosity internal realization built a robot, found a voice"
    );
  });
});