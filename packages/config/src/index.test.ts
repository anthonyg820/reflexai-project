import { describe, expect, it } from "vitest";
import { ConfigError, loadApiConfig, validateDeployConfig } from "./index";

const base = { DEPLOY_ENV: "local", CLOUD_PROVIDER: "local", DATABASE_URL: "postgres://x" };

describe("loadApiConfig", () => {
  it("applies defaults", () => {
    const cfg = loadApiConfig(base);
    expect(cfg.PORT).toBe(8080);
    expect(cfg.SCORING_RUBRIC).toBe("rubric-a");
    expect(cfg.CONFIG_VALIDATION).toBe("startup");
    expect(cfg.MIGRATE_ON_START).toBe(false);
  });

  it("rejects an unknown rubric at startup (the Scenario A fix)", () => {
    expect(() => loadApiConfig({ ...base, SCORING_RUBRIC: "rubric-c" })).toThrow(ConfigError);
  });

  it("accepts an unknown rubric in lazy mode (reproduces Scenario A)", () => {
    expect(loadApiConfig({ ...base, SCORING_RUBRIC: "rubric-c", CONFIG_VALIDATION: "lazy" }).SCORING_RUBRIC).toBe(
      "rubric-c",
    );
  });
});

describe("validateDeployConfig", () => {
  const file = { DEPLOY_ENV: "prod", CLOUD_PROVIDER: "gcp", SCORING_RUBRIC: "rubric-b" };

  it("passes a valid file", () => expect(validateDeployConfig(file)).toEqual([]));
  it("flags unknown rubrics even in lazy mode", () =>
    expect(validateDeployConfig({ ...file, SCORING_RUBRIC: "rubric-c", CONFIG_VALIDATION: "lazy" })).toHaveLength(1));
  it("flags unexpected keys such as secrets", () =>
    expect(validateDeployConfig({ ...file, DATABASE_URL: "postgres://oops" })).not.toEqual([]));
});
