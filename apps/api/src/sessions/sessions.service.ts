import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Message, PostMessageResponse, SessionDetail, SessionSummary } from "@rehearse/types";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { CONFIG, type ApiConfig } from "../config";
import { DB, type Db } from "../db/db.module";
import { messages, scenarios, sessions } from "../db/schema";
import { sessionScore, sessionsCompleted, sessionsStarted } from "../metrics";
import { nextPersonaLine } from "../scoring/persona";
import { coach, feedback } from "../scoring/coaching";
import { RUBRICS, getRubric } from "../scoring/rubrics";
import { toMessage, toSessionSummary } from "../serializers";

@Injectable()
export class SessionsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: ApiConfig,
  ) {}

  async start(tenantId: string, scenarioId: string): Promise<SessionDetail> {
    const [scenario] = await this.db
      .select()
      .from(scenarios)
      .where(and(eq(scenarios.tenantId, tenantId), eq(scenarios.id, scenarioId)));
    if (!scenario) throw new NotFoundException("Scenario not found");

    const session = await this.db.transaction(async (tx) => {
      const [s] = await tx.insert(sessions).values({ tenantId, scenarioId }).returning();
      await tx.insert(messages).values({ sessionId: s!.id, role: "persona", content: scenario.personaLines[0]! });
      return s!;
    });
    sessionsStarted.add(1, { "tenant.id": tenantId });
    return this.get(tenantId, session.id);
  }

  async get(tenantId: string, id: string): Promise<SessionDetail> {
    const { session, scenario } = await this.load(tenantId, id);
    const rows = await this.db.select().from(messages).where(eq(messages.sessionId, id)).orderBy(asc(messages.createdAt));
    const trainee = rows.filter((m) => m.role === "trainee").map((m) => m.content);
    const lastPersona = rows.filter((m) => m.role === "persona").at(-1)?.content;
    // Look the rubric up without throwing: only scoring (end) and the dashboard
    // resolve the configured rubric strictly (Scenario A).
    const rubric = RUBRICS[session.rubric ?? scenario.rubricId ?? this.config.SCORING_RUBRIC];
    const history = await this.db
      .select({ id: sessions.id, score: sessions.score, endedAt: sessions.endedAt })
      .from(sessions)
      .where(and(eq(sessions.tenantId, tenantId), eq(sessions.scenarioId, scenario.id), isNotNull(sessions.score)))
      .orderBy(desc(sessions.endedAt))
      .limit(5);
    return {
      ...toSessionSummary(session, scenario),
      difficulty: scenario.difficulty,
      channel: scenario.channel,
      messages: rows.map(toMessage),
      passingScore: rubric?.passingScore ?? null,
      rubricName: rubric?.name ?? null,
      coach: coach(trainee, scenario.persona, lastPersona),
      feedback: session.status === "completed" ? feedback(trainee, scenario.persona) : null,
      history: history.reverse().map((h) => ({ id: h.id, score: h.score!, endedAt: (h.endedAt ?? new Date()).toISOString() })),
    };
  }

  async postMessage(tenantId: string, id: string, content: string): Promise<PostMessageResponse> {
    const { session, scenario } = await this.load(tenantId, id);
    if (session.status !== "active") throw new ConflictException("Session already ended");

    const previous = (
      await this.db
        .select({ content: messages.content })
        .from(messages)
        .where(and(eq(messages.sessionId, id), eq(messages.role, "trainee")))
        .orderBy(asc(messages.createdAt))
    ).map((m) => m.content);
    const reply = nextPersonaLine(scenario.personaLines, previous.length);

    return this.db.transaction(async (tx) => {
      const [trainee] = await tx.insert(messages).values({ sessionId: id, role: "trainee", content }).returning();
      let persona: Message | null = null;
      if (reply) {
        // Make sure the reply sorts after the trainee message.
        const [p] = await tx
          .insert(messages)
          .values({ sessionId: id, role: "persona", content: reply, createdAt: new Date(trainee!.createdAt.getTime() + 1) })
          .returning();
        persona = toMessage(p!);
      }
      return { trainee: toMessage(trainee!), persona, coach: coach([...previous, content], scenario.persona, reply ?? undefined) };
    });
  }

  async end(tenantId: string, id: string): Promise<SessionSummary> {
    const { session, scenario } = await this.load(tenantId, id);
    if (session.status !== "active") return toSessionSummary(session, scenario);

    // The scenario's rubric, else the environment default. In lazy mode an
    // unknown default throws here -> HTTP 500 (Scenario A).
    const rubric = getRubric(scenario.rubricId ?? this.config.SCORING_RUBRIC);
    const traineeMessages = (
      await this.db
        .select({ content: messages.content })
        .from(messages)
        .where(and(eq(messages.sessionId, id), eq(messages.role, "trainee")))
    ).map((m) => m.content);
    const score = rubric.score({ traineeMessages });

    const [updated] = await this.db
      .update(sessions)
      .set({ status: "completed", score, rubric: rubric.id, endedAt: new Date() })
      .where(eq(sessions.id, id))
      .returning();

    const attrs = { "tenant.id": tenantId, "rehearse.rubric": rubric.id };
    sessionsCompleted.add(1, attrs);
    sessionScore.record(score, attrs);
    return toSessionSummary(updated!, scenario);
  }

  private async load(tenantId: string, id: string) {
    const [row] = await this.db
      .select({ session: sessions, scenario: scenarios })
      .from(sessions)
      .innerJoin(scenarios, eq(sessions.scenarioId, scenarios.id))
      .where(and(eq(sessions.tenantId, tenantId), eq(sessions.id, id)));
    if (!row) throw new NotFoundException("Session not found");
    return row;
  }
}
