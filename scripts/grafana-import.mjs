#!/usr/bin/env node
/**
 * Import deploy/grafana/*.json dashboards into a Grafana instance, make the
 * Rehearse overview the home dashboard, and provision the alert rules in
 * deploy/grafana/alerting/*.json (folder "Rehearse"). Used by `make up` /
 * `make dev` against the local otel-lgtm container, and by
 * bootstrap/6-grafana-dashboard.cmd against Grafana Cloud.
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

async function api(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${url}${path}`, { method, headers: { ...headers, ...extraHeaders }, body: body && JSON.stringify(body) });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

/** The Prometheus/Mimir data source the alert rules query (grafanacloud-prom on Grafana Cloud, prometheus locally). */
async function prometheusUid() {
  if (process.env.GRAFANA_PROMETHEUS_UID) return process.env.GRAFANA_PROMETHEUS_UID;
  try {
    const sources = (await api("GET", "/api/datasources")).filter((d) => d.type === "prometheus");
    const pick = sources.find((d) => d.isDefault) ?? sources.find((d) => d.uid === "grafanacloud-prom") ?? sources[0];
    if (pick) return pick.uid;
  } catch {
    /* token can't list data sources: fall back to Grafana Cloud's fixed uid */
  }
  return "grafanacloud-prom";
}

async function provisionAlerts() {
  const alertDir = join(dir, "alerting");
  const files = readdirSync(alertDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) return;
  const promUid = await prometheusUid();
  try {
    await api("GET", "/api/folders/rehearse");
  } catch {
    await api("POST", "/api/folders", { uid: "rehearse", title: "Rehearse" });
  }
  for (const file of files) {
    const group = JSON.parse(readFileSync(join(alertDir, file), "utf8").replaceAll("${PROMETHEUS_UID}", promUid));
    group.folderUid = "rehearse";
    for (const rule of group.rules) Object.assign(rule, { folderUID: "rehearse", ruleGroup: group.title, orgID: 1 });
    try {
      // X-Disable-Provenance keeps the rules editable in the UI.
      await api("PUT", `/api/v1/provisioning/folder/rehearse/rule-groups/${group.title}`, group, { "X-Disable-Provenance": "true" });
      console.log(`grafana: alert rules "${group.rules.map((r) => r.title).join(", ")}" provisioned (data source ${promUid}) -> ${url}/alerting/list`);
    } catch (err) {
      console.log(`grafana: (skipped alert rules: ${String(err).slice(0, 200)}; provisioning alerts needs an Admin token)`);
    }
  }
}

try {
  await waitForGrafana();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const dashboard = JSON.parse(readFileSync(join(dir, file), "utf8"));
    delete dashboard.id;
    const result = await api("POST", "/api/dashboards/db", { dashboard, overwrite: true, message: "imported by scripts/grafana-import.mjs" });
    console.log(`grafana: imported "${dashboard.title}" -> ${url}${result.url}`);
  }
  try {
    await api("PUT", "/api/org/preferences", { homeDashboardUID: "rehearse-overview" });
    console.log("grafana: Rehearse overview is now the home dashboard");
  } catch {
    // Needs an Admin token; Editor tokens can import dashboards but not change org preferences.
    console.log("grafana: (skipped setting the home dashboard: the token needs the Admin role for that)");
  }
  await provisionAlerts();
} catch (err) {
  // Never fail the caller (make up / make dev) over dashboards.
  console.warn(`grafana: dashboard import skipped: ${err instanceof Error ? err.message : err}`);
}
