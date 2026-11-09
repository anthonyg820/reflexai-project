import { z } from "zod";

/**
 * Rubrics this build of the code knows how to score with.
 * Adding a rubric here (and its implementation in the API) is a code change,
 * so a config file that names a new rubric fails validation until the image
 * that ships that rubric is the one being deployed.
 */
export const KNOWN_RUBRICS = ["rubric-a", "rubric-b"] as const;
export type Rubric = (typeof KNOWN_RUBRICS)[number];

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

/**
 * Non-secret runtime config that lives in deploy/config/<env>.env.yaml and
 * ships together with the image in a single revision / task definition.
 */
export const deployConfigSchema = z.object({
  DEPLOY_ENV: z.enum(["local", "dev", "uat", "prod"]),
  CLOUD_PROVIDER: z.enum(["local", "gcp", "aws"]),
  SCORING_RUBRIC: z.string().min(1).default("rubric-a"),
  /**
   * startup: reject unknown config when the process starts (the fix).
   * lazy:    accept anything and fail when a request uses it (reproduces Scenario A).
   */
  CONFIG_VALIDATION: z.enum(["startup", "lazy"]).default("startup"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  MIGRATE_ON_START: bool,
  DB_SSL: bool,
});

/** Full API config: deploy config + values injected by the platform/release. */
export const apiConfigSchema = deployConfigSchema
  .extend({
    PORT: z.coerce.number().int().positive().default(8080),
    DATABASE_URL: z.string().min(1),
    SERVICE_VERSION: z.string().min(1).default("dev"),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.CONFIG_VALIDATION === "startup" && !isKnownRubric(cfg.SCORING_RUBRIC)) {
      ctx.addIssue({
        code: "custom",
        path: ["SCORING_RUBRIC"],
        message: `Unknown rubric "${cfg.SCORING_RUBRIC}". This build supports: ${KNOWN_RUBRICS.join(", ")}`,
      });
    }
  });

export type DeployConfig = z.infer<typeof deployConfigSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema>;

export function isKnownRubric(value: string): value is Rubric {
  return (KNOWN_RUBRICS as readonly string[]).includes(value);
}

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid configuration:\n  - ${issues.join("\n  - ")}`);
    this.name = "ConfigError";
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

export function loadApiConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  const result = apiConfigSchema.safeParse(env);
  if (!result.success) throw new ConfigError(formatIssues(result.error));
  return result.data;
}

/**
 * Validate a deploy config file's contents (already parsed from YAML).
 * Deploy files must use startup validation semantics: they may only name
 * rubrics this build knows, regardless of CONFIG_VALIDATION.
 */
export function validateDeployConfig(values: unknown): string[] {
  const result = deployConfigSchema.strict().safeParse(values);
  if (!result.success) return formatIssues(result.error);
  const issues: string[] = [];
  if (!isKnownRubric(result.data.SCORING_RUBRIC)) {
    issues.push(
      `SCORING_RUBRIC: Unknown rubric "${result.data.SCORING_RUBRIC}". This build supports: ${KNOWN_RUBRICS.join(", ")}`,
    );
  }
  return issues;
}
