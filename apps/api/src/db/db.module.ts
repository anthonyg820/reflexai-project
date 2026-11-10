import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { CONFIG, type ApiConfig } from "../config";
import * as schema from "./schema";

export const DB = Symbol("DB");
export const PG_POOL = Symbol("PG_POOL");
export type Db = NodePgDatabase<typeof schema>;

const log = new Logger("Database");

/**
 * Errors that mean "this connection is gone", not "this query is wrong".
 * Neon suspends an idle compute (after 5 minutes on the free plan) and ends
 * every open connection with 57P01; the next query on a pooled connection
 * then fails. One retry on a fresh connection fixes it.
 */
const TRANSIENT_CODES = new Set(["57P01", "57P02", "57P03", "08000", "08003", "08006", "08001", "ECONNRESET", "EPIPE", "ETIMEDOUT"]);
export function isTransientConnectionError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined;
  if (!e) return false;
  if (e.code && TRANSIENT_CODES.has(e.code)) return true;
  return /Connection terminated|connection.*(closed|ended)|Client has encountered a connection error/i.test(e.message ?? "");
}

/**
 * A pg Pool that (1) never crashes the process when an idle connection dies
 * and (2) retries a single statement once when its connection was already dead.
 * Transactions (pool.connect()) are not retried.
 */
export class ResilientPool extends Pool {
  constructor(config: PoolConfig) {
    super(config);
    // Without a listener, an idle client's error is an unhandled 'error' event
    // and Node exits: the API restarted and users saw 5xx (dev, Nov 9).
    this.on("error", (err) => log.warn(`idle database connection dropped (${(err as { code?: string }).code ?? err.message}); it will be replaced`));
  }

  // Drizzle calls pool.query(config, params) and awaits the promise.
  override query(...args: unknown[]): never {
    const call = () => (Pool.prototype.query as (...a: unknown[]) => unknown).apply(this, args);
    if (typeof args[args.length - 1] === "function") return call() as never;
    return (call() as Promise<unknown>).catch((err: unknown) => {
      if (!isTransientConnectionError(err)) throw err;
      log.warn(`retrying a query after a dropped connection (${(err as { code?: string }).code ?? (err as Error).message})`);
      return call();
    }) as never;
  }
}

export function createPool(cfg: Pick<ApiConfig, "DATABASE_URL" | "DB_SSL">): Pool {
  return new ResilientPool({
    connectionString: cfg.DATABASE_URL,
    ssl: cfg.DB_SSL ? { rejectUnauthorized: true } : undefined,
    max: 5,
    // Close idle connections well before Neon suspends the compute (5 minutes),
    // and let TCP keepalive notice dead ones.
    idleTimeoutMillis: 60_000,
    keepAlive: true,
    connectionTimeoutMillis: 15_000, // a suspended Neon compute takes a few seconds to wake
  });
}

@Global()
@Module({
  providers: [
    { provide: PG_POOL, inject: [CONFIG], useFactory: (cfg: ApiConfig) => createPool(cfg) },
    { provide: DB, inject: [PG_POOL], useFactory: (pool: Pool): Db => drizzle(pool, { schema }) },
  ],
  exports: [DB, PG_POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
