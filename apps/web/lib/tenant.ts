import { TENANTS, type TenantId } from "@rehearse/types";

export const TENANT_COOKIE = "tenant";
export const DEFAULT_TENANT: TenantId = TENANTS[0].id;

export function normalizeTenant(value: string | undefined): TenantId {
  return TENANTS.find((t) => t.id === value)?.id ?? DEFAULT_TENANT;
}
