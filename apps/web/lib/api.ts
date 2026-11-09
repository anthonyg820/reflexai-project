import "server-only";
import { TENANT_HEADER } from "@rehearse/types";
import { cookies } from "next/headers";
import { runtimeInfo } from "./runtime";
import { TENANT_COOKIE, normalizeTenant } from "./tenant";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function currentTenant() {
  return normalizeTenant((await cookies()).get(TENANT_COOKIE)?.value);
}

/** Server-side call to the API (from Server Components and Server Actions). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${runtimeInfo().apiUrl}/api${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      [TENANT_HEADER]: await currentTenant(),
      ...init.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, `API ${init.method ?? "GET"} ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}
