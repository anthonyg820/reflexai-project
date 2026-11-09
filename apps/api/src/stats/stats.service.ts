import { Inject, Injectable } from "@nestjs/common";
import type { Stats } from "@rehearse/types";
import { desc, eq, sql } from "drizzle-orm";
import { CONFIG, type ApiConfig } from "../config";
import { DB, type Db } from "../db/db.module";
import { scenarios, sessions } from "../db/schema";
import { getRubric } from "../scoring/rubrics";
import { toSessionSummary } from "../serializers";

const round = (n: number | string | null) => (n === null ? null : Math.round(Number(n)));

@Injectable()
export class StatsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: ApiConfig,
  ) {}

  async get(tenantId: string): Promise<Stats> {
    // Every dashboard load resolves the active rubric, so in lazy mode a bad
    // SCORING_RUBRIC breaks the home page for every tenant — as in Scenario A.
    const rubric = getRubric(this.config.SCORING_RUBRIC);

    const byScenario = await this.db
      .select({
        scenarioId: scenarios.id,
        title: scenarios.title,
        sessions: sql<number>`count(${sessions.id})::int`,
        completed: sql<number>`count(${sessions.id}) filter (where ${sessions.status} = 'completed')::int`,
        averageScore: sql<string | null>`avg(${sessions.score})`,
      })
      .from(scenarios)
      .leftJoin(sessions, eq(sessions.scenarioId, scenarios.id))
      .where(eq(scenarios.tenantId, tenantId))
      .groupBy(scenarios.id, scenarios.title)
      .orderBy(scenarios.title);

    const recentRows = await this.db
      .select({ session: sessions, title: scenarios.title })
      .from(sessions)
      .innerJoin(scenarios, eq(sessions.scenarioId, scenarios.id))
      .where(eq(sessions.tenantId, tenantId))
      .orderBy(desc(sessions.createdAt))
      .limit(10);

    const [totals] = await this.db
      .select({
        sessions: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${sessions.status} = 'completed')::int`,
        averageScore: sql<string | null>`avg(${sessions.score})`,
      })
      .from(sessions)
      .where(eq(sessions.tenantId, tenantId));

    return {
      rubric: { id: rubric.id, name: rubric.name, passingScore: rubric.passingScore },
      totals: {
        scenarios: byScenario.length,
        sessions: totals?.sessions ?? 0,
        completed: totals?.completed ?? 0,
        averageScore: round(totals?.averageScore ?? null),
      },
      byScenario: byScenario.map((r) => ({ ...r, averageScore: round(r.averageScore) })),
      recent: recentRows.map((r) => toSessionSummary(r.session, r.title)),
    };
  }
}
