/**
 * Minimal forward-only SQL migrator. Applies migrations/*.sql in name order,
 * each in its own transaction, under a Postgres advisory lock so concurrent
 * instances (e.g. several Cloud Run instances starting at once) can't race.
 *
 * Migrations must be backward compatible with the previous release
 * (expand/contract), because the old revision keeps serving during rollout.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Pool } from "pg";

const LOCK_ID = 727274; // arbitrary, app-wide
export const MIGRATIONS_DIR = resolve(__dirname, "..", "..", "migrations");

export async function migrate(pool: Pool, dir = MIGRATIONS_DIR, log: (msg: string) => void = console.log) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = new Set(
      (await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name),
    );
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      await client.query("BEGIN");
      try {
        await client.query(readFileSync(join(dir, file), "utf8"));
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        log(`migration applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
