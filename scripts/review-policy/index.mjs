#!/usr/bin/env node
/**
 * Apply the review policy to one pull request (Scenario B):
 *   1. classify it (classify.mjs) and set exactly one risk:low|medium|high label
 *   2. post the `review-policy` commit status on the head commit: success when
 *      the review requirement for that risk is met, pending otherwise
 *      (the repo ruleset makes `review-policy` a required check)
 *   3. low risk: turn on auto-merge so it merges itself once CI is green;
 *      anything else: make sure auto-merge is off
 *
 * Usage: node scripts/review-policy/index.mjs <pr-number> [--dry-run]
 *        (--dry-run: classify and print, change nothing)
 * Env:   GITHUB_TOKEN, GITHUB_REPOSITORY, optional GITHUB_STEP_SUMMARY
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { classify, parseCodeOwners, reviewSatisfied } from "./classify.mjs";

const number = Number(process.argv[2]);
const dryRun = process.argv.includes("--dry-run");
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!number || !repo || !token) {
  console.error("usage: GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/review-policy/index.mjs <pr-number>");
  process.exit(2);
}

async function gh(method, path, body) {
  if (dryRun && method !== "GET") return null;
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
    body: body && JSON.stringify(body),
  });
  if (res.status === 404 && method === "GET") return null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function paged(path) {
  const all = [];
  for (let page = 1; ; page++) {
    const items = await gh("GET", `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    all.push(...(items ?? []));
    if (!items || items.length < 100) return all;
  }
}

async function fileAt(path, ref) {
  const f = await gh("GET", `/repos/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}?ref=${encodeURIComponent(ref)}`);
  return f?.content ? Buffer.from(f.content, "base64").toString("utf8") : null;
}

const LABELS = {
  "risk:low": ["0e8a16", "Merges itself when CI passes"],
  "risk:medium": ["fbca04", "Needs one human approval"],
  "risk:high": ["d93f0b", "Needs a code owner"],
  agent: ["5319e7", "Written by a coding agent"],
};

const pr = await gh("GET", `/repos/${repo}/pulls/${number}`);
const files = (await paged(`/repos/${repo}/pulls/${number}/files`)).map((f) => f.filename);
const packageJson = {};
for (const f of files.filter((f) => f.endsWith("package.json"))) {
  const [base, head] = await Promise.all([fileAt(f, pr.base.sha), fileAt(f, pr.head.sha)]);
  packageJson[f] = { base: base && JSON.parse(base), head: head && JSON.parse(head) };
}
const labels = pr.labels.map((l) => l.name);
const verdict = classify({ files, packageJson, author: pr.user.login, branch: pr.head.ref, labels });

const reviews = await paged(`/repos/${repo}/pulls/${number}/reviews`);
const codeOwners = parseCodeOwners((await fileAt(".github/CODEOWNERS", pr.base.ref)) ?? "");
const review = reviewSatisfied(verdict.risk, reviews, pr.user.login, codeOwners);

// Labels: exactly one risk label, plus "agent" when it applies.
for (const [name, [color, description]] of Object.entries(LABELS)) {
  await gh("POST", `/repos/${repo}/labels`, { name, color, description }).catch(() => {}); // 422 = exists
}
for (const l of labels.filter((l) => l.startsWith("risk:") && l !== `risk:${verdict.risk}`)) {
  await gh("DELETE", `/repos/${repo}/issues/${number}/labels/${encodeURIComponent(l)}`).catch(() => {});
}
const add = [`risk:${verdict.risk}`, ...(verdict.agent ? ["agent"] : [])].filter((l) => !labels.includes(l));
if (add.length) await gh("POST", `/repos/${repo}/issues/${number}/labels`, { labels: add });

const state = review.ok ? "success" : "pending";
const description = (
  review.ok
    ? verdict.risk === "low"
      ? "low risk: no human review needed"
      : `${verdict.risk} risk: approved by ${review.approvers.join(", ")}`
    : review.blocked
      ? `${verdict.risk} risk: changes requested`
      : `${verdict.risk} risk: waiting for ${verdict.requirement}`
).slice(0, 140);
await gh("POST", `/repos/${repo}/statuses/${pr.head.sha}`, {
  state,
  context: "review-policy",
  description,
  target_url: `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repo}/blob/${pr.base.ref}/scripts/review-policy/classify.mjs`,
});

// Auto-merge: on for low risk, off for anything else (e.g. a later push made it riskier).
let autoMerge = "unchanged";
if (pr.state === "open" && !pr.draft && !dryRun) {
  const args = verdict.risk === "low" ? ["pr", "merge", String(number), "--auto", "--squash"] : ["pr", "merge", String(number), "--disable-auto"];
  if (verdict.risk === "low" || pr.auto_merge) {
    try {
      execFileSync("gh", [...args, "--repo", repo], { stdio: "pipe", env: { ...process.env, GH_TOKEN: token } });
      autoMerge = verdict.risk === "low" ? "enabled" : "disabled";
    } catch (err) {
      autoMerge = `not changed (${String(err.stderr ?? err).trim().split("\n")[0]})`;
    }
  }
}

const report = { number, title: pr.title, url: pr.html_url, ...verdict, status: state, description, autoMerge };
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      `#### [#${number}](${pr.html_url}) ${pr.title}`,
      `- **risk:${verdict.risk}**${verdict.agent ? " (agent-written)" : ""}: ${verdict.reasons.join("; ")}`,
      `- requirement: ${verdict.requirement}`,
      `- \`review-policy\` status: **${state}** (${description})`,
      `- auto-merge: ${autoMerge}`,
      "",
    ].join("\n") + "\n",
  );
}
