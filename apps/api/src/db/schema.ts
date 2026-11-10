import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    title: text("title").notNull(),
    persona: text("persona").notNull(),
    description: text("description").notNull(),
    personaLines: jsonb("persona_lines").$type<string[]>().notNull(),
    difficulty: text("difficulty", { enum: ["intro", "core", "advanced"] }).notNull().default("core"),
    channel: text("channel").notNull().default(""),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    minutes: integer("minutes").notNull().default(10),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scenarios_tenant_idx").on(t.tenantId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "completed"] }).notNull().default("active"),
    score: integer("score"),
    rubric: text("rubric"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("sessions_tenant_idx").on(t.tenantId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["persona", "trainee"] }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_session_idx").on(t.sessionId)],
);
