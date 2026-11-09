#!/usr/bin/env node
/**
 * Import deploy/grafana/*.json dashboards into a Grafana instance and make the
 * Rehearse overview the home dashboard. Used by `make up` / `make dev` against
 * the local otel-lgtm container; works against Grafana Cloud too with a token.
 *
 *   GRAFANA_URL    default http://localhost:3001
 *   GRAFANA_TOKEN  service account token (otherwise GRAFANA_USER/GRAFANA_PASSWORD, default admin/admin)
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = (process.env.GRAFANA_URL ?? "http://localhost:3001").replace(/\/$/, "");
const auth = process.env.GRAFANA_TOKEN
  ? `Bearer ${process.env.GRAFANA_TOKEN}`
  : `Basic ${Buffer.from(`${process.env.GRAFANA_USER ?? "admin"}:${process.env.GRAFANA_PASSWORD ?? "admin"}`).toString("base64")}`;
const headers = { authorization: auth, "content-type": "application/json" };
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "deploy", "grafana");

async function waitForGrafana(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok && (await res.json()).database === "ok") return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Grafana at ${url} did not become healthy in ${timeoutMs / 1000}s`);
}

async function api(method, path, body) {
  const res = await fetch(`${url}${path}`, { method, headers, body: body && JSON.stringify(body) });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

try {
  await waitForGrafana();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const dashboard = JSON.parse(readFileSync(join(dir, file), "utf8"));
    delete dashboard.id;
    const result = await api("POST", "/api/dashboards/db", { dashboard, overwrite: true, message: "imported by scripts/grafana-import.mjs" });
    console.log(`grafana: imported "${dashboard.title}" -> ${url}${result.url}`);
  }
  await api("PUT", "/api/org/preferences", { homeDashboardUID: "rehearse-overview" });
  console.log("grafana: Rehearse overview is now the home dashboard");
} catch (err) {
  // Never fail the caller (make up / make dev) over dashboards.
  console.warn(`grafana: dashboard import skipped: ${err instanceof Error ? err.message : err}`);
}
