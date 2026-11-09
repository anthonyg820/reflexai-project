import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateScenarioRequest, Scenario } from "@rehearse/types";
import { and, desc, eq } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";
import { scenarios } from "../db/schema";
import { toScenario } from "../serializers";

@Injectable()
export class ScenariosService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(tenantId: string): Promise<Scenario[]> {
    const rows = await this.db
      .select()
      .from(scenarios)
      .where(eq(scenarios.tenantId, tenantId))
      .orderBy(desc(scenarios.createdAt));
    return rows.map(toScenario);
  }

  async get(tenantId: string, id: string): Promise<Scenario> {
    const [row] = await this.db
      .select()
      .from(scenarios)
      .where(and(eq(scenarios.tenantId, tenantId), eq(scenarios.id, id)));
    if (!row) throw new NotFoundException("Scenario not found");
    return toScenario(row);
  }

  async create(tenantId: string, input: CreateScenarioRequest): Promise<Scenario> {
    const [row] = await this.db
      .insert(scenarios)
      .values({ tenantId, ...input })
      .returning();
    return toScenario(row!);
  }
}
