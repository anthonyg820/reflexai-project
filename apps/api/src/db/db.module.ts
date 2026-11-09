import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { CONFIG, type ApiConfig } from "../config";
import * as schema from "./schema";

export const DB = Symbol("DB");
export const PG_POOL = Symbol("PG_POOL");
export type Db = NodePgDatabase<typeof schema>;

export function createPool(cfg: Pick<ApiConfig, "DATABASE_URL" | "DB_SSL">): Pool {
  return new Pool({
    connectionString: cfg.DATABASE_URL,
    ssl: cfg.DB_SSL ? { rejectUnauthorized: true } : undefined,
    max: 5,
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
