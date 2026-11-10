import { describe, expect, it } from "vitest";
import { criteria } from "./coaching";
import { CRITERIA_INFO, RUBRIC_INFO } from "./rubric-info";
import { RUBRICS } from "./rubrics";

describe("rubric info", () => {
  it("describes every rubric, and nothing else", () => {
    expect(Object.keys(RUBRIC_INFO).sort()).toEqual(Object.keys(RUBRICS).sort());
  });

  it("describes every coaching criterion in order", () => {
    expect(CRITERIA_INFO.map((c) => c.id)).toEqual(criteria([]).map((c) => c.id));
  });
});
