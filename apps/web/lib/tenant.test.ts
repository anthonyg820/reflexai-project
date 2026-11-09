import { describe, expect, it } from "vitest";
import { DEFAULT_TENANT, normalizeTenant } from "./tenant";

describe("normalizeTenant", () => {
  it("keeps known tenants", () => expect(normalizeTenant("northwind-health")).toBe("northwind-health"));
  it("falls back to the default for unknown values", () => {
    expect(normalizeTenant("evil")).toBe(DEFAULT_TENANT);
    expect(normalizeTenant(undefined)).toBe(DEFAULT_TENANT);
  });
});
