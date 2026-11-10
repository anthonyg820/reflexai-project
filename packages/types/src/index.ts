/** Shared API contract between apps/web and apps/api. */

export const TENANT_HEADER = "x-tenant-id";
export const TENANTS = [
  { id: "acme-crisis-line", name: "Acme Crisis Line" },
  { id: "northwind-health", name: "Northwind Health" },
  { id: "harbor-bank", name: "Harbor Bank" },
] as const;
export type TenantId = (typeof TENANTS)[number]["id"];

export const DIFFICULTIES = ["intro", "core", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Scenario {
  id: string;
  title: string;
  persona: string;
  description: string;
  personaLines: string[];
  difficulty: Difficulty;
  /** e.g. "Phone · returning caller" */
  channel: string;
  skills: string[];
  /** Rough length of a practice run. */
  minutes: number;
  createdAt: string;
}

export interface CreateScenarioRequest {
  title: string;
  persona: string;
  description: string;
  personaLines: string[];
  difficulty?: Difficulty;
  channel?: string;
  skills?: string[];
  minutes?: number;
}

export type MessageRole = "persona" | "trainee";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export type SessionStatus = "active" | "completed";

export interface SessionSummary {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  persona: string;
  status: SessionStatus;
  score: number | null;
  rubric: string | null;
  createdAt: string;
  endedAt: string | null;
}

/** One coaching criterion, scored 0-5 from the trainee's messages so far. */
export interface CriterionScore {
  id: "empathy" | "open-questions" | "reflection" | "pacing";
  name: string;
  score: number;
  note: string;
}

export interface Coaching {
  criteria: CriterionScore[];
  /** Short suggestions for the next reply. kind "try" = improve, "good" = keep doing. */
  tips: { kind: "try" | "good"; text: string }[];
}

export interface KeyMoment {
  kind: "strong" | "missed";
  quote: string;
  feedback: string;
}

export interface SessionFeedback {
  summary: string;
  criteria: CriterionScore[];
  moments: KeyMoment[];
}

export interface SessionDetail extends SessionSummary {
  difficulty: Difficulty;
  channel: string;
  messages: Message[];
  /** Passing score of the rubric this session is (or will be) scored with, if known. */
  passingScore: number | null;
  rubricName: string | null;
  /** Live coaching from the transcript so far (rules-based, independent of the rubric score). */
  coach: Coaching;
  /** Only for completed sessions. */
  feedback: SessionFeedback | null;
  /** Up to 5 most recent completed attempts at this scenario in this tenant, oldest first. */
  history: { id: string; score: number; endedAt: string }[];
}

export interface PostMessageResponse {
  trainee: Message;
  persona: Message | null;
  coach: Coaching;
}

export interface ScenarioStats {
  scenarioId: string;
  title: string;
  persona: string;
  difficulty: Difficulty;
  sessions: number;
  completed: number;
  averageScore: number | null;
  /** Share of completed sessions at or above the passing score, 0-100. */
  passRate: number | null;
}

export interface RubricInfo {
  id: string;
  name: string;
  passingScore: number;
}

export interface Stats {
  rubric: RubricInfo;
  totals: {
    scenarios: number;
    sessions: number;
    completed: number;
    averageScore: number | null;
    /** 0-100 */
    passRate: number | null;
  };
  /** The coaching criterion with the lowest average across completed sessions (0-100). */
  weakestSkill: { name: string; average: number } | null;
  byScenario: ScenarioStats[];
  recent: SessionSummary[];
}

export interface Health {
  status: "ok";
  service: string;
  version: string;
  environment: string;
  cloud: string;
  rubric: string;
}
