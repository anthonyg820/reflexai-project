import { describe, expect, it } from "vitest";
import { coach, criteria, feedback } from "./coaching";

const good = [
  "I'm really glad you called back. That sounds so frustrating.",
  "It sounds like you felt brushed off last time. What happened on that call?",
  "Which part of the last few weeks has been weighing on you most?",
];
const weak = ["ok", "sure", "Have you tried breathing exercises? Or going for a walk? Or sleeping more?"];

describe("coaching criteria", () => {
  it("scores 0 with no replies", () => {
    expect(criteria([]).every((c) => c.score === 0)).toBe(true);
  });

  it("returns four criteria in a fixed order, each 0-5", () => {
    const c = criteria(good);
    expect(c.map((x) => x.id)).toEqual(["empathy", "open-questions", "reflection", "pacing"]);
    for (const x of c) {
      expect(x.score).toBeGreaterThanOrEqual(0);
      expect(x.score).toBeLessThanOrEqual(5);
    }
  });

  it("rates a strong transcript above a weak one on every criterion", () => {
    const strong = criteria(good), poor = criteria(weak);
    strong.forEach((s, i) => expect(s.score).toBeGreaterThanOrEqual(poor[i]!.score));
    expect(poor.find((c) => c.id === "pacing")!.score).toBeLessThan(5);
  });

  it("matches curly apostrophes", () => {
    const straight = criteria(["What i'm hearing is that work is a lot."]);
    const curly = criteria(["What i’m hearing is that work is a lot."]);
    expect(curly).toEqual(straight);
  });
});

describe("live coach", () => {
  it("suggests an opener before any replies", () => {
    expect(coach([], "Sam, 41").tips[0]!.text).toMatch(/Sam/);
  });

  it("targets the weakest criterion and praises the strongest", () => {
    const tips = coach(["What happened?", "How long has that been going on?"], "Sam, 41", "Nobody listens.").tips;
    expect(tips[0]!.kind).toBe("try");
    expect(tips.some((t) => t.kind === "good")).toBe(true);
  });
});

describe("scorecard feedback", () => {
  it("picks strong and missed moments from the transcript", () => {
    const f = feedback([...good, "ok"], "Sam, 41");
    expect(f.moments.map((m) => m.kind)).toEqual(["strong", "missed", "strong"]);
    expect(f.summary).toMatch(/Strongest/);
  });
});
