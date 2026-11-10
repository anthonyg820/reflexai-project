import { Inject, Injectable } from "@nestjs/common";
import type { RubricPreview, Rubrics } from "@rehearse/types";
import { and, eq, sql } from "drizzle-orm";
import { CONFIG, type ApiConfig } from "../config";
import { DB, type Db } from "../db/db.module";
import { scenarios, sessions } from "../db/schema";
import { criteria } from "../scoring/coaching";
import { CRITERIA_INFO } from "../scoring/rubric-info";
import { RUBRICS, describeRules } from "../scoring/rubrics";

@Injectable()
export class RubricsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: ApiConfig,
  ) {}

  /**
   * Never throws on an unknown SCORING_RUBRIC: this page reports it instead,
   * which makes it a handy view during the Scenario A demo.
   */
  async list(tenantId: string): Promise<Rubrics> {
    const usage = await this.db
      .select({
        rubric: sessions.rubric,
        sessions: sql<number>`count(*)::int`,
        averageScore: sql<string | null>`avg(${sessions.score})`,
        scores: sql<number[]>`array_agg(${sessions.score})`,
      })
      .from(sessions)
      .where(and(eq(sessions.tenantId, tenantId), eq(sessions.status, "completed")))
      .groupBy(sessions.rubric);

    const configured = this.config.SCORING_RUBRIC;
    const tenantScenarios = await this.db
      .select({ id: scenarios.id, title: scenarios.title, rubricId: scenarios.rubricId })
      .from(scenarios)
      .where(eq(scenarios.tenantId, tenantId))
      .orderBy(scenarios.title);
    return {
      configured,
      configuredKnown: configured in RUBRICS,
      rubrics: Object.values(RUBRICS).map((r) => {
        const u = usage.find((x) => x.rubric === r.id);
        const passed = u ? u.scores.filter((s) => s !== null && s >= r.passingScore).length : 0;
        return {
          id: r.id,
          name: r.name,
          passingScore: r.passingScore,
          description: r.description,
          rules: describeRules(r),
          isDefault: r.id === configured,
          scenarios: tenantScenarios.filter((s) => (s.rubricId ?? configured) === r.id).map(({ id, title }) => ({ id, title })),
          sessions: u?.sessions ?? 0,
          averageScore: u?.averageScore == null ? null : Math.round(Number(u.averageScore)),
          passRate: u && u.sessions > 0 ? Math.round((100 * passed) / u.sessions) : null,
        };
      }),
      criteria: CRITERIA_INFO,
    };
  }

  /** Score sample replies with every rubric, without saving anything. */
  preview(messages: string[]): RubricPreview {
    return {
      scores: Object.values(RUBRICS).map((r) => {
        const score = r.score({ traineeMessages: messages });
        return { id: r.id, name: r.name, score, passingScore: r.passingScore, passed: score >= r.passingScore };
      }),
      criteria: criteria(messages),
    };
  }
}
