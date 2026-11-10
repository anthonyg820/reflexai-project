/** Descriptions of the coaching criteria for the Rubrics page (rubrics describe themselves in rubrics.ts). */
import type { CriterionScore } from "@rehearse/types";

export const CRITERIA_INFO: { id: CriterionScore["id"]; name: string; description: string }[] = [
  { id: "empathy", name: "Empathy", description: "Naming and acknowledging feelings before problem-solving." },
  { id: "open-questions", name: "Open questions", description: "“What” and “how” questions that invite the other person to say more." },
  { id: "reflection", name: "Reflective listening", description: "Mirroring their words back so they know they were heard." },
  { id: "pacing", name: "Pacing", description: "One idea and one question per reply, at a comfortable length." },
];
