import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { DIFFICULTIES, type CreateScenarioRequest, type Scenario } from "@rehearse/types";
import { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { TenantId } from "../tenant/tenant.decorator";
import { RUBRICS } from "../scoring/rubrics";
import { ScenariosService } from "./scenarios.service";

const createScenarioSchema = z.object({
  title: z.string().trim().min(3).max(120),
  persona: z.string().trim().min(2).max(80),
  description: z.string().trim().min(1).max(1000),
  personaLines: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  difficulty: z.enum(DIFFICULTIES).optional(),
  channel: z.string().trim().max(60).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
  minutes: z.number().int().min(1).max(60).optional(),
  rubricId: z
    .string()
    .refine((id) => id in RUBRICS, { message: "Unknown rubric" })
    .optional(),
}) satisfies z.ZodType<CreateScenarioRequest>;

@Controller("scenarios")
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  list(@TenantId() tenantId: string): Promise<Scenario[]> {
    return this.scenarios.list(tenantId);
  }

  @Get(":id")
  get(@TenantId() tenantId: string, @Param("id", ParseUUIDPipe) id: string): Promise<Scenario> {
    return this.scenarios.get(tenantId, id);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(createScenarioSchema)) body: CreateScenarioRequest,
  ): Promise<Scenario> {
    return this.scenarios.create(tenantId, body);
  }
}
