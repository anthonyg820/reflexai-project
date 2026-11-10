/**
 * Human-readable descriptions of each rubric for the Rubrics page. Kept next
 * to rubrics.ts (and checked by rubric-info.test.ts) so the explanation can't
 * drift from the scoring code without a failing test.
 */
import type { CriterionScore, RubricRule } from "@rehearse/types";

export const RUBRIC_INFO: Record<string, { description: string; rules: RubricRule[] }> = {
  "rubric-a": {
    description: "Rewards warmth: naming feelings and acknowledging what the other person is going through.",
    rules: [
      { label: "Starting score", points: "40" },
      { label: "Each empathy phrase used (counted once each)", points: "+10" },
      { label: "Each reply", points: "+5" },
    ],
  },
  "rubric-b": {
    description: "Rewards listening skills: asking questions and reflecting the other person's words back.",
    rules: [
      { label: "Starting score", points: "30" },
      { label: "Each reply containing a question", points: "+12" },
      { label: "Each reflection (“it sounds like…”, “so you’re saying…”)", points: "+15" },
      { label: "Each reply", points: "+4" },
      { label: "Each reply under 4 words", points: "−8" },
    ],
  },
};

export const CRITERIA_INFO: { id: CriterionScore["id"]; name: string; description: string }[] = [
  { id: "empathy", name: "Empathy", description: "Naming and acknowledging feelings before problem-solving." },
  { id: "open-questions", name: "Open questions", description: "“What” and “how” questions that invite the other person to say more." },
  { id: "reflection", name: "Reflective listening", description: "Mirroring their words back so they know they were heard." },
  { id: "pacing", name: "Pacing", description: "One idea and one question per reply, at a comfortable length." },
];
