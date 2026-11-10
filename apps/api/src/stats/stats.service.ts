import { Inject, Injectable } from "@nestjs/common";
import type { Stats } from "@rehearse/types";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { CONFIG, type ApiConfig } from "../config";
import { DB, type Db } from "../db/db.module";
import { messages, scenarios, sessions } from "../db/schema";
import { criteria } from "../scoring/coaching";
import { RUBRICS, getRubric } from "../scoring/rubrics";
import { toSessionSummary } from "../serializers";

/** SQL: did this session reach the passing score of the rubric it was scored with? */
const PASSED = sql`${sessions.score} >= (CASE ${sessions.rubric} ${sql.raw(
  Object.values(RUBRICS)
    .map((r) => `WHEN '${r.id}' THEN ${r.passingScore}`)
    .join(" "),
)} END)`;

const round = (n: number | string | null) => (n === null ? null : Math.round(Number(n)));

@Injectable()
export class StatsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: ApiConfig,
  ) {}

  async get(tenantId: string): Promise<Stats> {
    // Every dashboard load resolves the environment's default rubric, so in lazy
    // mode a bad SCORING_RUBRIC breaks the home page for every tenant (Scenario A).
    const rubric = getRubric(this.config.SCORING_RUBRIC);

    const byScenario = await this.db
      .select({
        scenarioId: scenarios.id,
        title: scenarios.title,
        persona: scenarios.persona,
        difficulty: scenarios.difficulty,
        rubricId: scenarios.rubricId,
        sessions: sql<number>`count(${sessions.id})::int`,
        completed: sql<number>`count(${sessions.id}) filter (where ${sessions.status} = 'completed')::int`,
        passed: sql<number>`count(${sessions.id}) filter (where ${PASSED})::int`,
        averageScore: sql<string | null>`avg(${sessions.score})`,
      })
      .from(scenarios)
      .leftJoin(sessions, eq(sessions.scenarioId, scenarios.id))
      .where(eq(scenarios.tenantId, tenantId))
      .groupBy(scenarios.id, scenarios.title, scenarios.persona, scenarios.difficulty, scenarios.rubricId)
      .orderBy(scenarios.title);

    const recentRows = await this.db
      .select({ session: sessions, title: scenarios.title, persona: scenarios.persona })
      .from(sessions)
      .innerJoin(scenarios, eq(sessions.scenarioId, scenarios.id))
      .where(eq(sessions.tenantId, tenantId))
      .orderBy(desc(sessions.createdAt))
      .limit(10);

    const [totals] = await this.db
      .select({
        sessions: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${sessions.status} = 'completed')::int`,
        passed: sql<number>`count(*) filter (where ${PASSED})::int`,
        averageScore: sql<string | null>`avg(${sessions.score})`,
      })
      .from(sessions)
      .where(eq(sessions.tenantId, tenantId));

    const pct = (passed: number, completed: number) => (completed === 0 ? null : Math.round((100 * passed) / completed));

    return {
      rubric: { id: rubric.id, name: rubric.name, passingScore: rubric.passingScore },
      totals: {
        scenarios: byScenario.length,
        sessions: totals?.sessions ?? 0,
        completed: totals?.completed ?? 0,
        averageScore: round(totals?.averageScore ?? null),
        passRate: pct(totals?.passed ?? 0, totals?.completed ?? 0),
      },
      weakestSkill: await this.weakestSkill(tenantId),
      byScenario: byScenario.map(({ passed, rubricId, ...r }) => ({
        ...r,
        rubricName: RUBRICS[rubricId ?? rubric.id]?.name ?? rubricId ?? rubric.id,
        averageScore: round(r.averageScore),
        passRate: pct(passed, r.completed),
      })),
      recent: recentRows.map((r) => toSessionSummary(r.session, r)),
    };
  }

  /** Lowest-average coaching criterion over the last 100 completed sessions. */
  private async weakestSkill(tenantId: string): Promise<Stats["weakestSkill"]> {
    const done = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.tenantId, tenantId), eq(sessions.status, "completed")))
      .orderBy(desc(sessions.endedAt))
      .limit(100);
    if (done.length === 0) return null;
    const rows = await this.db
      .select({ sessionId: messages.sessionId, content: messages.content })
      .from(messages)
      .where(and(inArray(messages.sessionId, done.map((d) => d.id)), eq(messages.role, "trainee")))
      .orderBy(asc(messages.createdAt));
    const bySession = new Map<string, string[]>(done.map((d) => [d.id, []]));
    for (const r of rows) bySession.get(r.sessionId)?.push(r.content);
    const totals = new Map<string, number>();
    for (const msgs of bySession.values()) for (const c of criteria(msgs)) totals.set(c.name, (totals.get(c.name) ?? 0) + c.score);
    const [name, total] = [...totals].sort((a, b) => a[1] - b[1])[0]!;
    return { name, average: Math.round((total / bySession.size / 5) * 100) };
  }
}
