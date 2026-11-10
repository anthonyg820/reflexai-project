import { describe, expect, it } from "vitest";
import { normalizeTheme } from "./theme";

describe("normalizeTheme", () => {
  it("accepts light and dark only", () => {
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("blue")).toBeNull();
    expect(normalizeTheme(undefined)).toBeNull();
  });
});
