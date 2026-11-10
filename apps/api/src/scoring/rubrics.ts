/**
 * Scoring rubrics. Pure functions so they're trivially unit-testable.
 * The set of ids here must match KNOWN_RUBRICS in @rehearse/config
 * (enforced by rubrics.test.ts).
 */
export interface Transcript {
  traineeMessages: string[];
}

export interface RubricDefinition {
  id: string;
  name: string;
  passingScore: number;
  score(t: Transcript): number;
}

const EMPATHY = ["understand", "sorry", "hear you", "that sounds", "makes sense", "feel", "thank you for"];
const REFLECTIONS = ["it sounds like", "what i'm hearing", "so you're saying", "you feel", "you're feeling"];

const countHits = (text: string, phrases: string[]) => phrases.filter((p) => text.includes(p)).length;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const RUBRICS: Record<string, RubricDefinition> = {
  "rubric-a": {
    id: "rubric-a",
    name: "Empathy basics",
    passingScore: 70,
    score({ traineeMessages }) {
      if (traineeMessages.length === 0) return 0;
      const text = traineeMessages.join(" ").toLowerCase();
      return clamp(40 + 10 * countHits(text, EMPATHY) + 5 * traineeMessages.length);
    },
  },
  "rubric-b": {
    id: "rubric-b",
    name: "Active listening",
    passingScore: 75,
    score({ traineeMessages }) {
      if (traineeMessages.length === 0) return 0;
      const lower = traineeMessages.map((m) => m.toLowerCase());
      const questions = lower.filter((m) => m.includes("?")).length;
      const reflections = lower.reduce((n, m) => n + countHits(m, REFLECTIONS), 0);
      const tooShort = lower.filter((m) => m.trim().split(/\s+/).length < 4).length;
      return clamp(30 + 12 * questions + 15 * reflections + 4 * lower.length - 8 * tooShort);
    },
  },
};

/** Throws on an unknown rubric — this is the code path that 500s in Scenario A. */
export function getRubric(id: string): RubricDefinition {
  const rubric = RUBRICS[id];
  if (!rubric) throw new Error(`Unknown scoring rubric "${id}"`);
  return rubric;
}

// Shared with coaching.ts (live coaching and the scorecard).
export { EMPATHY, REFLECTIONS };
