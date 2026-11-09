import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import type { PostMessageResponse, SessionDetail, SessionSummary } from "@rehearse/types";
import { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { TenantId } from "../tenant/tenant.decorator";
import { SessionsService } from "./sessions.service";

const startSchema = z.object({ scenarioId: z.uuid() });
const messageSchema = z.object({ content: z.string().trim().min(1).max(2000) });

@Controller("sessions")
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  start(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(startSchema)) body: z.infer<typeof startSchema>,
  ): Promise<SessionDetail> {
    return this.sessions.start(tenantId, body.scenarioId);
  }

  @Get(":id")
  get(@TenantId() tenantId: string, @Param("id", ParseUUIDPipe) id: string): Promise<SessionDetail> {
    return this.sessions.get(tenantId, id);
  }

  @Post(":id/messages")
  postMessage(
    @TenantId() tenantId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(messageSchema)) body: z.infer<typeof messageSchema>,
  ): Promise<PostMessageResponse> {
    return this.sessions.postMessage(tenantId, id, body.content);
  }

  @Post(":id/end")
  @HttpCode(200)
  end(@TenantId() tenantId: string, @Param("id", ParseUUIDPipe) id: string): Promise<SessionSummary> {
    return this.sessions.end(tenantId, id);
  }
}
