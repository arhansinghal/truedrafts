import { describe, it, expect } from "vitest";
import { chunkText } from "../studio/chunk";

describe("chunkText", () => {
  it("returns empty for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("preserves a single short paragraph as one chunk", () => {
    const out = chunkText("Hello world from Stanford. We study agritech.");
    expect(out.length).toBe(1);
    expect(out[0].text).toContain("Stanford");
  });

  it("splits a long doc into multiple chunks", () => {
    const para = ("alpha beta gamma delta epsilon ".repeat(200)).trim();
    const out = chunkText(para);
    expect(out.length).toBeGreaterThan(1);
    // Token count is roughly words / 0.75 — check it's positive on every chunk.
    for (const c of out) expect(c.tokenCount).toBeGreaterThan(0);
  });

  it("assigns monotonically increasing ord", () => {
    const out = chunkText("paragraph one. ".repeat(200));
    const ords = out.map((c) => c.ord);
    expect(ords).toEqual([...ords].sort((a, b) => a - b));
  });
});
