import { describe, expect, it } from "vitest";

import { errorResponseSchema } from "./error";

describe("errorResponseSchema", () => {
  it("accepts a minimal error response", () => {
    expect(() =>
      errorResponseSchema.parse({ code: "VALIDATION_ERROR", message: "Invalid input" }),
    ).not.toThrow();
  });

  it("accepts fieldErrors as a record of string arrays", () => {
    expect(() =>
      errorResponseSchema.parse({
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        fieldErrors: { email: ["Enter a valid email address"] },
      }),
    ).not.toThrow();
  });

  it("rejects an unknown error code", () => {
    expect(() =>
      errorResponseSchema.parse({ code: "TOTALLY_MADE_UP", message: "oops" }),
    ).toThrow();
  });
});
