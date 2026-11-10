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

  it("matches phrases typed with curly apostrophes", () => {
    const straight = getRubric("rubric-b").score({ traineeMessages: ["What i'm hearing is that work is a lot?"] });
    const curly = getRubric("rubric-b").score({ traineeMessages: ["What I\u2019m hearing is that work is a lot?"] });
    expect(curly).toBe(straight);
  });
});

describe("every rubric", () => {
  const strong: Record<string, string[]> = {
    "rubric-a": ["I'm so sorry, that sounds hard. I understand.", "Thank you for telling me. It makes sense you feel this way."],
    "rubric-b": ["It sounds like work has been a lot. What has been hardest?", "So you're saying sleep is the issue?"],
    optimism: ["You've already made real progress this week.", "The next step is small, and we can do it together. I'm glad you called."],
    "sales-persistence": [
      "What matters most to you in an account?",
      "That's fair. Many customers felt the same until they saw the lower rate and no fees.",
      "Could we schedule ten minutes next week so I can send you the numbers?",
    ],
    "de-escalation": ["I hear you, and that makes sense. I'd be upset too.", "Let's sort this out together. Take your time."],
    "clear-explanation": ["Your new pill replaces the old one, once a day with food.", "To recap: one pill, with breakfast. Does that make sense? Any questions?"],
    "service-recovery": ["I'm so sorry about this. Let me fix it.", "I'll call you back today with a case number, within two hours."],
    "crisis-safety": ["I'm really glad you texted. Are you safe right now?", "Who can you reach out to tonight? I'll stay with you while we make a plan. You can also call 988."],
  };
  const weak: Record<string, string[]> = {
    "rubric-a": ["ok", "next"],
    "rubric-b": ["ok", "sure", "fine"],
    optimism: ["Unfortunately there's nothing we can do.", "No way that works."],
    "sales-persistence": ["ok", "fine, bye"],
    "de-escalation": ["Calm down, that's the policy.", "You need to wait like everyone else."],
    "clear-explanation": [
      "The medication was contraindicated so we're titrating the new one and your claim will be adjudicated pursuant to the plan terms which means the deductible accumulator resets and any amortization of the remaining balance follows the standard schedule that applies to your account type unless an exception is approved by the review board.",
    ],
    "service-recovery": ["That's not our fault.", "You should have read the policy."],
    "crisis-safety": ["Cheer up, it's not that bad.", "You'll be fine."],
  };

  it("has a strong and a weak example for each rubric", () => {
    expect(Object.keys(strong).sort()).toEqual(Object.keys(RUBRICS).sort());
    expect(Object.keys(weak).sort()).toEqual(Object.keys(RUBRICS).sort());
  });

  for (const id of Object.keys(strong)) {
    it(`${id}: a strong transcript passes and a weak one fails`, () => {
      const r = getRubric(id);
      expect(r.score({ traineeMessages: strong[id]! })).toBeGreaterThanOrEqual(r.passingScore);
      expect(r.score({ traineeMessages: weak[id]! })).toBeLessThan(r.passingScore);
    });
  }
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
