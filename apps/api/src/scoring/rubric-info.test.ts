import { describe, expect, it } from "vitest";
import { criteria } from "./coaching";
import { CRITERIA_INFO } from "./rubric-info";
import { RUBRICS, describeRules } from "./rubrics";

describe("rubric descriptions", () => {
  it("every rubric describes itself and every signal has a label", () => {
    for (const r of Object.values(RUBRICS)) {
      expect(r.description.length).toBeGreaterThan(10);
      expect(describeRules(r)[0]).toEqual({ label: "Starting score", points: String(r.base) });
      for (const s of r.signals) expect(s.label.length).toBeGreaterThan(3);
    }
  });

  it("describes every coaching criterion in order", () => {
    expect(CRITERIA_INFO.map((c) => c.id)).toEqual(criteria([]).map((c) => c.id));
  });
});
