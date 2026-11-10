#!/usr/bin/env node
/**
 * Scenario B demo: find a real, low-risk dependency update to open a PR for,
 * the way Renovate would. Picks a devDependency (used by one workspace only,
 * so the diff stays small) that has a newer patch/minor release on npm.
 * Prints JSON: { workspace, dir, name, from, to }
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const dirs = [".", ...["apps", "packages"].flatMap((d) => readdirSync(d).map((x) => join(d, x)))].filter((d) =>
  existsSync(join(d, "package.json")),
);
const manifests = dirs.map((dir) => ({ dir, pkg: JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) }));

const uses = new Map();
for (const { pkg } of manifests)
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) uses.set(name, (uses.get(name) ?? 0) + 1);

const semver = (v) => (/^\d+\.\d+\.\d+$/.test(v) ? v.split(".").map(Number) : null);
const newer = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

for (const { dir, pkg } of manifests) {
  for (const [name, from] of Object.entries(pkg.devDependencies ?? {})) {
    const cur = semver(from);
    if (!cur || uses.get(name) !== 1) continue;
    const res = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, {
      headers: { accept: "application/vnd.npm.install-v1+json" },
    });
    if (!res.ok) continue;
    const versions = Object.keys((await res.json()).versions ?? {})
      .map(semver)
      .filter((v) => v && v[0] === cur[0] && newer(v, cur) > 0)
      .sort(newer);
    if (versions.length) {
      const to = versions.at(-1).join(".");
      console.log(JSON.stringify({ workspace: pkg.name, dir, name, from, to }));
      process.exit(0);
    }
  }
}
console.error("No devDependency has a newer patch/minor release right now.");
process.exit(1);
