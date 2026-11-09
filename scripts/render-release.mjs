#!/usr/bin/env node
/**
 * Renders the revision spec for one service in one environment:
 *   image digest + this commit's runtime config + this commit's shape  ->  one file
 *
 *   GCP: deploy/cloudrun/<service>.yaml  -> Knative Service YAML for `gcloud run services replace`
 *   AWS: deploy/ecs/<service>.json       -> task definition for `aws ecs register-task-definition`
 *
 * The api's env vars come from deploy/config/<cloud>-<env>.env.yaml and are
 * validated against @rehearse/config first, so an image can never be paired
 * with config it doesn't understand.
 *
 * Example:
 *   node scripts/render-release.mjs --cloud gcp --env uat --service api \
 *     --image REGION-docker.pkg.dev/P/rehearse/api@sha256:... \
 *     --collector-image ...@sha256:... --version <git-sha> --run-id 123 \
 *     --project P --region us-east1 --grafana-endpoint https://... --grafana-instance-id 123 \
 *     [--prev-revision rehearse-uat-api-abc] [--api-url https://...] --out rendered.yaml
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parse, stringify } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { values: a } = parseArgs({
  options: {
    cloud: { type: "string" },
    env: { type: "string" },
    service: { type: "string" },
    image: { type: "string" },
    "collector-image": { type: "string" },
    version: { type: "string" },
    "run-id": { type: "string", default: "0" },
    project: { type: "string" },
    "account-id": { type: "string" },
    region: { type: "string" },
    "grafana-endpoint": { type: "string", default: "" },
    "grafana-instance-id": { type: "string", default: "" },
    "api-url": { type: "string", default: "" },
    "prev-revision": { type: "string", default: "" },
    out: { type: "string" },
  },
});

function fail(msg) {
  console.error(`render-release: ${msg}`);
  process.exit(1);
}
for (const k of ["cloud", "env", "service", "image", "collector-image", "version", "region", "out"]) {
  if (!a[k]) fail(`--${k} is required`);
}
if (!["gcp", "aws"].includes(a.cloud)) fail("--cloud must be gcp or aws");
if (!["dev", "uat", "prod"].includes(a.env)) fail("--env must be dev, uat or prod");
if (!["api", "web"].includes(a.service)) fail("--service must be api or web");
for (const k of ["image", "collector-image"]) {
  if (!/@sha256:[a-f0-9]{64}$/.test(a[k])) fail(`--${k} must be pinned by digest (…@sha256:<64 hex>)`);
}
// The Collector sidecar exits on an empty OTLP endpoint, and on Cloud Run the
// app container waits for it, so the revision would never become ready.
if (!a["grafana-endpoint"] || !a["grafana-instance-id"]) {
  fail("--grafana-endpoint and --grafana-instance-id are required (set GRAFANA_OTLP_* repo variables)");
}
if (a.service === "web" && !a["api-url"]) fail("--api-url is required for web");
if (a.cloud === "gcp" && !a.project) fail("--project is required for gcp");
if (a.cloud === "aws" && !a["account-id"]) fail("--account-id is required for aws");

const prefix = `rehearse-${a.env}`;
const serviceName = `${prefix}-${a.service}`;
const revisionName = `${serviceName}-${a.version.slice(0, 7)}-${a["run-id"]}`.toLowerCase().slice(0, 63);
const vars = {
  SERVICE_NAME: serviceName,
  NAME_PREFIX: prefix,
  REVISION_NAME: revisionName,
  ENV: a.env,
  VERSION: a.version,
  IMAGE: a.image,
  COLLECTOR_IMAGE: a["collector-image"],
  REGION: a.region,
  PROJECT: a.project ?? "",
  ACCOUNT_ID: a["account-id"] ?? "",
  RUNTIME_SA: `${serviceName}@${a.project}.iam.gserviceaccount.com`,
  SECRET_PREFIX: prefix,
  API_URL: a["api-url"],
  GRAFANA_OTLP_ENDPOINT: a["grafana-endpoint"],
  GRAFANA_OTLP_INSTANCE_ID: a["grafana-instance-id"],
};

const templatePath = join(root, "deploy", a.cloud === "gcp" ? "cloudrun" : "ecs", `${a.service}.${a.cloud === "gcp" ? "yaml" : "json"}`);
// Substitute placeholders, ignoring comment lines so docs can mention ${...}.
const text = readFileSync(templatePath, "utf8")
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n")
  .replace(/\$\{([A-Z_]+)\}/g, (_, name) => {
    if (!(name in vars)) fail(`unknown placeholder \${${name}} in ${templatePath}`);
    return vars[name];
  });

// Runtime config for the api, validated against THIS commit's schema.
let configEnv = [];
if (a.service === "api") {
  const configFile = join(root, "deploy", "config", `${a.cloud}-${a.env}.env.yaml`);
  const config = parse(readFileSync(configFile, "utf8"));
  const { validateDeployConfig } = await import(join(root, "packages", "config", "dist", "index.js"));
  const issues = validateDeployConfig(config);
  if (issues.length) fail(`${configFile} is invalid for this build:\n  ${issues.join("\n  ")}`);
  configEnv = Object.entries(config).map(([name, value]) => ({ name, value: String(value) }));
}

let output;
if (a.cloud === "gcp") {
  const doc = parse(text);
  const container = doc.spec.template.spec.containers.find((c) => c.name === a.service);
  container.env = [...configEnv, ...(container.env ?? [])];
  doc.spec.traffic = a["prev-revision"]
    ? [
        { revisionName: a["prev-revision"], percent: 100 },
        { revisionName, percent: 0, tag: "candidate" },
      ]
    : [{ latestRevision: true, percent: 100 }];
  output = stringify(doc);
} else {
  const doc = JSON.parse(text);
  const container = doc.containerDefinitions.find((c) => c.name === a.service);
  container.environment = [...configEnv, ...(container.environment ?? [])];
  output = JSON.stringify(doc, null, 2) + "\n";
}

writeFileSync(a.out, output);
console.log(`rendered ${a.cloud}/${a.env}/${a.service} -> ${a.out} (revision ${revisionName})`);
