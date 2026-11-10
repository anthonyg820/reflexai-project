/**
 * End-to-end API tests against a real Postgres.
 * Set DATABASE_URL_TEST (CI provides a postgres service container).
 */
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { loadApiConfig } from "@rehearse/config";
import { Pool } from "pg";
import "reflect-metadata";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { migrate } from "../src/db/migrate";

const url = process.env.DATABASE_URL_TEST;
const T = "acme-crisis-line";

describe.skipIf(!url)("API (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const pool = new Pool({ connectionString: url });
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await migrate(pool, undefined, () => undefined);
    await pool.end();

    const config = loadApiConfig({ DEPLOY_ENV: "local", CLOUD_PROVIDER: "local", DATABASE_URL: url, LOG_LEVEL: "error" });
    app = await NestFactory.create(AppModule.forRoot(config), { logger: false });
    app.setGlobalPrefix("api", { exclude: ["health"] });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("serves /health without a tenant", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", rubric: "rubric-a" });
  });

  it("requires a tenant header", async () => {
    await request(app.getHttpServer()).get("/api/scenarios").expect(400);
  });

  it("isolates tenants", async () => {
    const acme = await request(app.getHttpServer()).get("/api/scenarios").set("x-tenant-id", T).expect(200);
    const other = await request(app.getHttpServer()).get("/api/scenarios").set("x-tenant-id", "northwind-health").expect(200);
    const harbor = await request(app.getHttpServer()).get("/api/scenarios").set("x-tenant-id", "harbor-bank").expect(200);
    expect(acme.body).toHaveLength(5);
    expect(other.body).toHaveLength(2);
    expect(harbor.body).toHaveLength(2);
    expect(acme.body.find((s: { title: string }) => s.title === "Caller in acute crisis")).toMatchObject({
      difficulty: "advanced",
      skills: ["Risk assessment", "Safety planning"],
    });
    expect(acme.body[0].id).not.toBe(other.body[0].id);
  });

  it("validates scenario input", async () => {
    await request(app.getHttpServer()).post("/api/scenarios").set("x-tenant-id", T).send({ title: "x" }).expect(400);
  });

  it("runs a full session: create scenario, chat, end, score, stats", async () => {
    const http = app.getHttpServer();
    const scenario = await request(http)
      .post("/api/scenarios")
      .set("x-tenant-id", T)
      .send({ title: "Test scenario", persona: "Tess", description: "d", personaLines: ["Hello", "Second line"] })
      .expect(201);

    const session = await request(http).post("/api/sessions").set("x-tenant-id", T).send({ scenarioId: scenario.body.id }).expect(201);
    expect(session.body.messages).toHaveLength(1);
    expect(session.body.messages[0]).toMatchObject({ role: "persona", content: "Hello" });

    const reply = await request(http)
      .post(`/api/sessions/${session.body.id}/messages`)
      .set("x-tenant-id", T)
      .send({ content: "I'm sorry, that sounds hard. I understand." })
      .expect(201);
    expect(reply.body.persona.content).toBe("Second line");
    expect(reply.body.coach.criteria).toHaveLength(4);
    expect(reply.body.coach.tips.length).toBeGreaterThan(0);

    const ended = await request(http).post(`/api/sessions/${session.body.id}/end`).set("x-tenant-id", T).expect(200);
    expect(ended.body.status).toBe("completed");
    expect(ended.body.rubric).toBe("rubric-a");
    expect(ended.body.score).toBeGreaterThan(0);

    const detail = await request(http).get(`/api/sessions/${session.body.id}`).set("x-tenant-id", T).expect(200);
    expect(detail.body).toMatchObject({ persona: "Tess", difficulty: "core", passingScore: 70, rubricName: "Empathy basics" });
    expect(detail.body.feedback.criteria).toHaveLength(4);
    expect(detail.body.history).toEqual([expect.objectContaining({ id: session.body.id, score: ended.body.score })]);

    await request(http)
      .post(`/api/sessions/${session.body.id}/messages`)
      .set("x-tenant-id", T)
      .send({ content: "still there?" })
      .expect(409);

    // Another tenant can't see it.
    await request(http).get(`/api/sessions/${session.body.id}`).set("x-tenant-id", "northwind-health").expect(404);

    const stats = await request(http).get("/api/stats").set("x-tenant-id", T).expect(200);
    expect(stats.body.rubric).toMatchObject({ id: "rubric-a" });
    expect(stats.body.totals.completed).toBe(1);
    expect(stats.body.recent[0]).toMatchObject({ id: session.body.id, persona: "Tess" });
    expect(stats.body.totals.passRate).toEqual(expect.any(Number));
    const rubrics = await request(http).get("/api/rubrics").set("x-tenant-id", T).expect(200);
    expect(rubrics.body).toMatchObject({ configured: "rubric-a", configuredKnown: true });
    expect(rubrics.body.rubrics.find((r: { id: string }) => r.id === "rubric-a")).toMatchObject({ active: true, sessions: 1 });
    expect(rubrics.body.criteria).toHaveLength(4);

    const preview = await request(http)
      .post("/api/rubrics/preview")
      .set("x-tenant-id", T)
      .send({ messages: ["I'm so sorry, that sounds hard.", "What has been the hardest part?"] })
      .expect(200);
    expect(preview.body.scores.map((s: { id: string }) => s.id).sort()).toEqual(["rubric-a", "rubric-b"]);
    expect(preview.body.criteria).toHaveLength(4);
    expect(stats.body.weakestSkill).toMatchObject({ name: expect.any(String), average: expect.any(Number) });
  });
});
