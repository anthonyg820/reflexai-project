import assert from "node:assert/strict";
import { test } from "node:test";
import { bumpType, classify, parseCodeOwners, reviewSatisfied } from "./classify.mjs";

const pkg = (devDependencies, dependencies = {}) => ({ name: "x", dependencies, devDependencies });

test("bumpType", () => {
  assert.equal(bumpType("1.2.3", "1.2.4"), "patch");
  assert.equal(bumpType("1.2.3", "1.3.0"), "minor");
  assert.equal(bumpType("^1.2.3", "2.0.0"), "major");
  assert.equal(bumpType("workspace:*", "1.0.0"), "other");
});

test("dev tooling patch/minor is low risk", () => {
  const r = classify({
    files: ["package.json", "pnpm-lock.yaml"],
    packageJson: { "package.json": { base: pkg({ yaml: "2.8.1" }), head: pkg({ yaml: "2.9.0" }) } },
    author: "renovate[bot]",
  });
  assert.equal(r.risk, "low");
});

test("runtime minor is medium, runtime patch is low", () => {
  const files = ["apps/api/package.json", "pnpm-lock.yaml"];
  const minor = classify({ files, author: "a", packageJson: { [files[0]]: { base: pkg({}, { pg: "8.1.0" }), head: pkg({}, { pg: "8.2.0" }) } } });
  const patch = classify({ files, author: "a", packageJson: { [files[0]]: { base: pkg({}, { pg: "8.1.0" }), head: pkg({}, { pg: "8.1.1" }) } } });
  assert.equal(minor.risk, "medium");
  assert.equal(patch.risk, "low");
});

test("major dependency update is high risk", () => {
  const r = classify({
    files: ["package.json"],
    packageJson: { "package.json": { base: pkg({ eslint: "9.0.0" }), head: pkg({ eslint: "10.0.0" }) } },
    author: "renovate[bot]",
  });
  assert.equal(r.risk, "high");
});

test("package.json changes beyond versions are not low risk", () => {
  const r = classify({
    files: ["package.json"],
    packageJson: { "package.json": { base: { scripts: { a: "1" } }, head: { scripts: { a: "2" } } } },
    author: "a",
  });
  assert.equal(r.risk, "medium");
});

test("platform paths are high risk, even mixed with app code", () => {
  assert.equal(classify({ files: ["apps/web/app/page.tsx", "infra/live/gcp/uat/api/terragrunt.hcl"], author: "a" }).risk, "high");
  assert.equal(classify({ files: ["apps/api/Dockerfile"], author: "a" }).risk, "high");
  assert.equal(classify({ files: ["packages/config/src/schema.ts"], author: "a" }).risk, "high");
});

test("agent-written app fixes are medium and flagged", () => {
  const r = classify({ files: ["apps/api/src/scoring/rubrics.ts"], author: "a", branch: "agent/fix-apostrophes" });
  assert.equal(r.risk, "medium");
  assert.equal(r.agent, true);
});

test("docs only is low", () => {
  assert.equal(classify({ files: ["docs/DEMO.md", "README.md"], author: "a" }).risk, "low");
});

test("approvals: bots and the author never count; high needs a code owner", () => {
  const reviews = [
    { user: { login: "github-actions[bot]", type: "Bot" }, state: "APPROVED" },
    { user: { login: "author", type: "User" }, state: "APPROVED" },
  ];
  assert.equal(reviewSatisfied("medium", reviews, "author", ["owner"]).ok, false);
  const peer = [...reviews, { user: { login: "peer", type: "User" }, state: "APPROVED" }];
  assert.equal(reviewSatisfied("medium", peer, "author", ["owner"]).ok, true);
  assert.equal(reviewSatisfied("high", peer, "author", ["owner"]).ok, false);
  const owner = [...peer, { user: { login: "owner", type: "User" }, state: "APPROVED" }];
  assert.equal(reviewSatisfied("high", owner, "author", ["owner"]).ok, true);
  const blocked = [...owner, { user: { login: "peer", type: "User" }, state: "CHANGES_REQUESTED" }];
  assert.equal(reviewSatisfied("high", blocked, "author", ["owner"]).ok, false);
  assert.equal(reviewSatisfied("low", [], "author", []).ok, true);
});

test("parseCodeOwners", () => {
  assert.deepEqual(parseCodeOwners("# c\n/infra/ @alice\n/deploy/ @alice @org/team @bob\n"), ["alice", "bob"]);
});
