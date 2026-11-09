"use client";
import { TENANT_HEADER } from "@rehearse/types";
import { TENANT_COOKIE, normalizeTenant } from "./tenant";

function tenantFromCookie() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${TENANT_COOKIE}=([^;]*)`));
  return normalizeTenant(match?.[1]);
}

/**
 * Browser-side call. Goes to same-origin /api/*, which is the web app's
 * proxy on GCP and the ALB's /api/* rule straight to the API on AWS.
 */
export async function clientApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", [TENANT_HEADER]: tenantFromCookie(), ...init.headers },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}
