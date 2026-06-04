import { describe, it, expect } from "vitest";
import { classifySentence } from "../studio/classifier";

describe("classifySentence", () => {
  it("rejects too-short input", () => {
    expect(classifySentence("Hi.").researchable).toBe(false);
  });

  it("rejects past-tense personal narrative", () => {
    expect(classifySentence("I felt afraid as a kid.").researchable).toBe(false);
    expect(classifySentence("When I was twelve, I started writing.").researchable).toBe(false);
    expect(classifySentence("My grandmother taught me to cook.").researchable).toBe(false);
    expect(classifySentence("Growing up, I loved music.").researchable).toBe(false);
  });

  it("triggers on research verb + proper noun", () => {
    const r = classifySentence("I want to research biology at Stanford.");
    expect(r.researchable).toBe(true);
    expect(r.topicHint).toContain("Stanford");
  });

  it("triggers on trailing opener with proper noun", () => {
    const r = classifySentence("I plan to study agritech at Stanford with");
    expect(r.researchable).toBe(true);
    expect(r.topicHint).toContain("Stanford");
  });

  it("triggers on research verb + lab + proper noun", () => {
    const r = classifySentence("I am drawn to the AI lab run by Professor Smith at MIT.");
    expect(r.researchable).toBe(true);
  });

  it("does not trigger on plain reflection without proper noun or research signal", () => {
    expect(classifySentence("This taught me patience.").researchable).toBe(false);
    expect(classifySentence("It changed how I see the world.").researchable).toBe(false);
  });

  it("topic hint dedupes across repeats", () => {
    const r = classifySentence("I want to research robotics at Stanford with the Stanford team.");
    const hint = r.topicHint.toLowerCase().split(/\s+/);
    const stanfordCount = hint.filter((t) => t === "stanford").length;
    expect(stanfordCount).toBeLessThanOrEqual(1);
  });

  it("handles trailing opener at sentence end with period", () => {
    const r = classifySentence("I am most excited about working on quantum computing with.");
    expect(r.researchable).toBe(true);
  });
});
