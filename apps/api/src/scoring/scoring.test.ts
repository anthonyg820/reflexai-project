import { KNOWN_RUBRICS } from "@rehearse/config";
import { describe, expect, it } from "vitest";
import { CLOSING_LINE, nextPersonaLine } from "./persona";
import { RUBRICS, getRubric } from "./rubrics";

describe("rubrics", () => {
  it("implements exactly the rubrics the config package declares", () => {
    expect(Object.keys(RUBRICS).sort()).toEqual([...KNOWN_RUBRICS].sort());
  });

  it("throws on an unknown rubric", () => {
    expect(() => getRubric("rubric-c")).toThrow(/Unknown scoring rubric/);
  });

  it("scores empty transcripts as 0", () => {
    for (const r of Object.values(RUBRICS)) expect(r.score({ traineeMessages: [] })).toBe(0);
  });

  it("rubric-a rewards empathy", () => {
    const cold = getRubric("rubric-a").score({ traineeMessages: ["ok", "next"] });
    const warm = getRubric("rubric-a").score({
      traineeMessages: ["I'm sorry you're dealing with this.", "That sounds really hard, I understand."],
    });
    expect(warm).toBeGreaterThan(cold);
  });

  it("rubric-b rewards questions and reflections, penalises one-word replies", () => {
    const good = getRubric("rubric-b").score({
      traineeMessages: ["It sounds like work has been a lot. What has been hardest?", "So you're saying sleep is the issue?"],
    });
    const bad = getRubric("rubric-b").score({ traineeMessages: ["ok", "sure", "fine"] });
    expect(good).toBeGreaterThan(bad);
    expect(good).toBeLessThanOrEqual(100);
  });
});

describe("nextPersonaLine", () => {
  const lines = ["open", "two", "three"];
  it("follows the script", () => {
    expect(nextPersonaLine(lines, 0)).toBe("two");
    expect(nextPersonaLine(lines, 1)).toBe("three");
  });
  it("closes once, then stays quiet", () => {
    expect(nextPersonaLine(lines, 2)).toBe(CLOSING_LINE);
    expect(nextPersonaLine(lines, 3)).toBeNull();
  });
});
