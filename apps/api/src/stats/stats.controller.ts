import { Controller, Get } from "@nestjs/common";
import type { Stats } from "@rehearse/types";
import { TenantId } from "../tenant/tenant.decorator";
import { StatsService } from "./stats.service";

@Controller("stats")
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  get(@TenantId() tenantId: string): Promise<Stats> {
    return this.stats.get(tenantId);
  }
}
