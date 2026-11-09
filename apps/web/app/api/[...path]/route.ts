import { TENANT_HEADER } from "@rehearse/types";
import type { NextRequest } from "next/server";
import { runtimeInfo } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/**
 * Runtime reverse proxy: /api/* → ${API_URL}/api/*.
 * Reads API_URL per request so the same image works in every environment.
 */
async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${runtimeInfo().apiUrl}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of ["content-type", "accept", TENANT_HEADER]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
    cache: "no-store",
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export { proxy as GET, proxy as POST };
