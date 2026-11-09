import { BadRequestException, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { trace } from "@opentelemetry/api";
import { TENANT_HEADER } from "@rehearse/types";
import type { Request } from "express";

const TENANT_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;

/** Resolves the tenant from the X-Tenant-Id header and tags the active span with it. */
export const TenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const raw = req.headers[TENANT_HEADER];
  const tenant = Array.isArray(raw) ? raw[0] : raw;
  if (!tenant || !TENANT_RE.test(tenant)) {
    throw new BadRequestException(`Missing or invalid ${TENANT_HEADER} header`);
  }
  trace.getActiveSpan()?.setAttribute("tenant.id", tenant);
  return tenant;
});
