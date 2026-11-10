import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import type { RubricPreview, RubricPreviewRequest, Rubrics } from "@rehearse/types";
import { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { TenantId } from "../tenant/tenant.decorator";
import { RubricsService } from "./rubrics.service";

const previewSchema = z.object({
  messages: z.array(z.string().trim().min(1).max(2000)).max(20),
}) satisfies z.ZodType<RubricPreviewRequest>;

@Controller("rubrics")
export class RubricsController {
  constructor(private readonly rubrics: RubricsService) {}

  @Get()
  list(@TenantId() tenantId: string): Promise<Rubrics> {
    return this.rubrics.list(tenantId);
  }

  @Post("preview")
  @HttpCode(200)
  preview(@TenantId() _tenantId: string, @Body(new ZodPipe(previewSchema)) body: RubricPreviewRequest): RubricPreview {
    return this.rubrics.preview(body.messages);
  }
}
