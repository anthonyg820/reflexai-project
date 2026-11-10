/**
 * Risk-based review policy (Scenario B). Pure functions, no I/O, so the policy
 * is easy to read and unit-test (classify.test.mjs).
 *
 *   low     docs only, or dependency updates that are patch/minor dev tooling or
 *           runtime patches. No human review: merges itself once CI is green.
 *           (It still goes dev -> UAT -> prod, and a person approves prod.)
 *   medium  application code, including agent-written fixes. One approval from
 *           a human who isn't the author. Bot approvals never count.
 *   high    platform paths (infra, deploy specs, workflows, migrations, runtime
 *           config schema, Dockerfiles) or major dependency updates. Approval
 *           from a code owner.
 */

export const HIGH_RISK_PATHS = [
  /^infra\//,
  /^deploy\//,
  /^\.github\//,
  /^bootstrap\//,
  /^apps\/api\/migrations\//,
  /^packages\/config\//,
  /^scripts\/render-release\.mjs$/,
  /^scripts\/review-policy\//,
  /(^|\/)Dockerfile$/,
];

const DOC_PATHS = [/\.md$/, /^docs\//];
const DEP_FILES = [/(^|\/)package\.json$/, /^pnpm-lock\.yaml$/];
const DEP_SECTIONS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const BOTS_THAT_UPDATE_DEPS = ["renovate[bot]", "dependabot[bot]"];

const parse = (v) => {
  const m = /^[~^]?(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? ""));
  return m ? m.slice(1).map(Number) : null;
};

/** "major" | "minor" | "patch" | "other" for one version change. */
export function bumpType(from, to) {
  const a = parse(from), b = parse(to);
  if (!a || !b) return "other";
  if (b[0] !== a[0]) return "major";
  if (b[1] !== a[1]) return "minor";
  return "patch";
}

/**
 * Compare two package.json objects. Returns the dependency changes, or null if
 * anything other than dependency versions changed (scripts, engines, ...).
 */
export function dependencyChanges(base, head) {
  const strip = (pkg) => Object.fromEntries(Object.entries(pkg ?? {}).filter(([k]) => !DEP_SECTIONS.includes(k)));
  if (JSON.stringify(strip(base)) !== JSON.stringify(strip(head))) return null;
  const changes = [];
  for (const section of DEP_SECTIONS) {
    const from = base?.[section] ?? {}, to = head?.[section] ?? {};
    for (const name of new Set([...Object.keys(from), ...Object.keys(to)])) {
      if (from[name] === to[name]) continue;
      changes.push({ name, section, from: from[name], to: to[name], bump: name in from && name in to ? bumpType(from[name], to[name]) : "other" });
    }
  }
  return changes;
}

const lowRiskDep = (c) =>
  (c.section === "devDependencies" && (c.bump === "patch" || c.bump === "minor")) ||
  (c.section === "dependencies" && c.bump === "patch");

/**
 * @param {object} pr
 * @param {string[]} pr.files       changed paths
 * @param {Record<string, {base: object, head: object}>} [pr.packageJson] contents of changed package.json files
 * @param {string} pr.author        PR author login
 * @param {string} [pr.branch]      head branch name
 * @param {string[]} [pr.labels]
 */
export function classify({ files, packageJson = {}, author, branch = "", labels = [] }) {
  const reasons = [];
  const agent = labels.includes("agent") || branch.startsWith("agent/");
  const depBot = BOTS_THAT_UPDATE_DEPS.includes(author) || branch.startsWith("renovate/");

  const high = files.filter((f) => HIGH_RISK_PATHS.some((re) => re.test(f)));
  if (high.length) {
    reasons.push(`touches platform paths: ${high.slice(0, 3).join(", ")}${high.length > 3 ? ", ..." : ""}`);
    return result("high", reasons, agent);
  }

  if (files.length && files.every((f) => DOC_PATHS.some((re) => re.test(f)))) {
    reasons.push("documentation only");
    return result("low", reasons, agent);
  }

  if (files.length && files.every((f) => DEP_FILES.some((re) => re.test(f)))) {
    const changes = [];
    for (const f of files.filter((f) => f.endsWith("package.json"))) {
      const c = dependencyChanges(packageJson[f]?.base, packageJson[f]?.head);
      if (c === null) {
        reasons.push(`${f} changes more than dependency versions`);
        return result("medium", reasons, agent);
      }
      changes.push(...c);
    }
    const describe = (c) => `${c.name} ${c.from ?? "(new)"} -> ${c.to ?? "(removed)"} (${c.section}, ${c.bump})`;
    if (changes.some((c) => c.bump === "major")) {
      reasons.push(`major dependency update: ${changes.filter((c) => c.bump === "major").map(describe).join("; ")}`);
      return result("high", reasons, agent);
    }
    if (changes.length && changes.every(lowRiskDep)) {
      reasons.push(`dependency update${depBot ? " from a bot" : ""}: ${changes.map(describe).join("; ")}`);
      return result("low", reasons, agent);
    }
    if (changes.length === 0) {
      reasons.push("lockfile-only change");
      return result("low", reasons, agent);
    }
    reasons.push(`runtime dependency change: ${changes.filter((c) => !lowRiskDep(c)).map(describe).join("; ")}`);
    return result("medium", reasons, agent);
  }

  reasons.push(agent ? "agent-written application change" : "application change");
  return result("medium", reasons, agent);
}

function result(risk, reasons, agent) {
  const requirement = {
    low: "no human review: merges itself when CI passes",
    medium: "1 approval from a human other than the author",
    high: "approval from a code owner",
  }[risk];
  return { risk, reasons, agent, requirement };
}

/**
 * Is the review requirement met?
 * @param {"low"|"medium"|"high"} risk
 * @param {{user: {login: string, type: string}, state: string}[]} reviews  in submission order
 * @param {string} author
 * @param {string[]} codeOwners logins (no @)
 */
export function reviewSatisfied(risk, reviews, author, codeOwners) {
  if (risk === "low") return { ok: true, approvers: [] };
  const latest = new Map();
  for (const r of reviews) {
    if (!r.user || r.user.type === "Bot" || r.user.login === author) continue;
    if (["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state)) latest.set(r.user.login, r.state);
  }
  const approvers = [...latest].filter(([, s]) => s === "APPROVED").map(([login]) => login);
  const blocked = [...latest].some(([, s]) => s === "CHANGES_REQUESTED");
  const qualified = risk === "high" ? approvers.filter((a) => codeOwners.includes(a)) : approvers;
  return { ok: !blocked && qualified.length > 0, approvers: qualified, blocked };
}

/** Logins named in a CODEOWNERS file (teams are ignored in this mock). */
export function parseCodeOwners(text) {
  const owners = new Set();
  for (const line of text.split("\n")) {
    const l = line.replace(/#.*/, "").trim();
    if (!l) continue;
    for (const o of l.split(/\s+/).slice(1)) if (o.startsWith("@") && !o.includes("/")) owners.add(o.slice(1));
  }
  return [...owners];
}
