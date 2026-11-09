#!/usr/bin/env node
/**
 * Validates every deploy/config/*.env.yaml against the config schema of THIS
 * commit. Runs in PR checks and again in the release job, so a config change
 * can never ship ahead of the code that understands it.
 *
 * Usage: rehearse-validate-config <dir-or-file> [...]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { validateDeployConfig } from "./index";

function collect(target: string): string[] {
  if (statSync(target).isDirectory()) {
    return readdirSync(target)
      .filter((f) => f.endsWith(".env.yaml"))
      .map((f) => join(target, f));
  }
  return [target];
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: rehearse-validate-config <dir-or-file> [...]");
  process.exit(2);
}

let failed = false;
for (const file of targets.flatMap(collect)) {
  const issues = validateDeployConfig(parse(readFileSync(file, "utf8")));
  if (issues.length) {
    failed = true;
    console.error(`✗ ${file}`);
    for (const issue of issues) console.error(`    ${issue}`);
  } else {
    console.log(`✓ ${file}`);
  }
}
process.exit(failed ? 1 : 0);
