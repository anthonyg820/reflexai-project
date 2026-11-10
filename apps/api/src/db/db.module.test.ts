import { describe, expect, it } from "vitest";
import { isTransientConnectionError } from "./db.module";

describe("isTransientConnectionError", () => {
  it("treats dropped connections as transient", () => {
    expect(isTransientConnectionError({ code: "57P01", message: "terminating connection due to administrator command" })).toBe(true);
    expect(isTransientConnectionError(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(isTransientConnectionError({ code: "ECONNRESET" })).toBe(true);
  });

  it("does not retry real query errors", () => {
    expect(isTransientConnectionError({ code: "23505", message: "duplicate key value" })).toBe(false);
    expect(isTransientConnectionError({ code: "42P01", message: 'relation "x" does not exist' })).toBe(false);
    expect(isTransientConnectionError(undefined)).toBe(false);
  });
});
