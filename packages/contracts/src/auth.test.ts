import { describe, expect, it } from "vitest";

import {
  changePasswordRequestSchema,
  loginRequestSchema,
  loginResponseSchema,
} from "./auth";

describe("loginRequestSchema", () => {
  it("accepts a valid email/password pair and normalizes the email", () => {
    const result = loginRequestSchema.parse({
      email: "  Admin@DevHubOne.com ",
      password: "correct-horse",
    });
    expect(result.email).toBe("admin@devhubone.com");
  });

  it("rejects an invalid email", () => {
    expect(() => loginRequestSchema.parse({ email: "not-an-email", password: "x" })).toThrow();
  });

  it("rejects an empty password", () => {
    expect(() =>
      loginRequestSchema.parse({ email: "admin@devhubone.com", password: "" }),
    ).toThrow();
  });
});

describe("loginResponseSchema", () => {
  it("accepts a well-formed response", () => {
    expect(() =>
      loginResponseSchema.parse({
        accessToken: "token",
        user: {
          id: "1",
          email: "admin@devhubone.com",
          role: "ADMIN",
          isActive: true,
          mustChangePassword: false,
        },
      }),
    ).not.toThrow();
  });

  it("rejects an unknown role", () => {
    expect(() =>
      loginResponseSchema.parse({
        accessToken: "token",
        user: {
          id: "1",
          email: "admin@devhubone.com",
          role: "SUPERUSER",
          isActive: true,
          mustChangePassword: false,
        },
      }),
    ).toThrow();
  });
});

describe("changePasswordRequestSchema", () => {
  it("accepts a valid, sufficiently long, different new password", () => {
    expect(() =>
      changePasswordRequestSchema.parse({
        currentPassword: "temporary-password",
        newPassword: "a-brand-new-password",
      }),
    ).not.toThrow();
  });

  it("rejects a new password shorter than 10 characters", () => {
    expect(() =>
      changePasswordRequestSchema.parse({
        currentPassword: "temporary-password",
        newPassword: "short",
      }),
    ).toThrow();
  });

  it("rejects a new password identical to the current password", () => {
    expect(() =>
      changePasswordRequestSchema.parse({
        currentPassword: "same-password-value",
        newPassword: "same-password-value",
      }),
    ).toThrow();
  });
});
