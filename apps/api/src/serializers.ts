import type { Message, Scenario, SessionSummary } from "@rehearse/types";
import type { messages, scenarios, sessions } from "./db/schema";
import { RUBRICS } from "./scoring/rubrics";

type ScenarioRow = typeof scenarios.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

/** `defaultRubric` is the environment's SCORING_RUBRIC, used when the scenario has none. */
export const toScenario = (r: ScenarioRow, defaultRubric: string): Scenario => ({
  id: r.id,
  title: r.title,
  persona: r.persona,
  description: r.description,
  personaLines: r.personaLines,
  difficulty: r.difficulty,
  channel: r.channel,
  skills: r.skills,
  minutes: r.minutes,
  rubricId: r.rubricId ?? defaultRubric,
  rubricName: RUBRICS[r.rubricId ?? defaultRubric]?.name ?? r.rubricId ?? defaultRubric,
  rubricExplicit: r.rubricId !== null,
  createdAt: r.createdAt.toISOString(),
});

export const toSessionSummary = (r: SessionRow, scenario: { title: string; persona: string }): SessionSummary => ({
  id: r.id,
  scenarioId: r.scenarioId,
  scenarioTitle: scenario.title,
  persona: scenario.persona,
  status: r.status,
  passed: r.score === null || !r.rubric || !RUBRICS[r.rubric] ? null : r.score >= RUBRICS[r.rubric]!.passingScore,
  score: r.score,
  rubric: r.rubric,
  createdAt: r.createdAt.toISOString(),
  endedAt: r.endedAt?.toISOString() ?? null,
});

export const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  role: r.role,
  content: r.content,
  createdAt: r.createdAt.toISOString(),
});
