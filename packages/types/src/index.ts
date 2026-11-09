/** Shared API contract between apps/web and apps/api. */

export const TENANT_HEADER = "x-tenant-id";
export const TENANTS = [
  { id: "acme-crisis-line", name: "Acme Crisis Line" },
  { id: "northwind-health", name: "Northwind Health" },
] as const;
export type TenantId = (typeof TENANTS)[number]["id"];

export interface Scenario {
  id: string;
  title: string;
  persona: string;
  description: string;
  personaLines: string[];
  createdAt: string;
}

export interface CreateScenarioRequest {
  title: string;
  persona: string;
  description: string;
  personaLines: string[];
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
  status: SessionStatus;
  score: number | null;
  rubric: string | null;
  createdAt: string;
  endedAt: string | null;
}

export interface SessionDetail extends SessionSummary {
  persona: string;
  messages: Message[];
}

export interface PostMessageResponse {
  trainee: Message;
  persona: Message | null;
}

export interface ScenarioStats {
  scenarioId: string;
  title: string;
  sessions: number;
  completed: number;
  averageScore: number | null;
}

export interface RubricInfo {
  id: string;
  name: string;
  passingScore: number;
}

export interface Stats {
  rubric: RubricInfo;
  totals: { scenarios: number; sessions: number; completed: number; averageScore: number | null };
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
