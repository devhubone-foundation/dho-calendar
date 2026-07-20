import { describe, expect, it } from "vitest";

import { EnvValidationError } from "./env-error";
import { parseApiEnv } from "./api-env";
import { parseWebEnv } from "./web-env";

const validApiEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/dho",
  JWT_ACCESS_SECRET: "access-secret-value-1234",
  JWT_REFRESH_SECRET: "refresh-secret-value-5678",
  APP_ORIGIN: "http://localhost:3000",
  API_ORIGIN: "http://localhost:4000",
};

const validWebEnv = {
  NODE_ENV: "test",
  NEXT_PUBLIC_API_ORIGIN: "http://localhost:4000",
  NEXT_PUBLIC_WS_ORIGIN: "ws://localhost:4000",
};

describe("parseApiEnv", () => {
  it("parses a valid environment and applies documented defaults", () => {
    const env = parseApiEnv(validApiEnv);
    expect(env.PORT).toBe(4000);
    expect(env.ACCESS_TOKEN_TTL).toBe("15m");
    expect(env.REFRESH_TOKEN_TTL).toBe("30d");
    expect(env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS).toBe(5);
    expect(env.LOGIN_RATE_LIMIT_WINDOW_MINUTES).toBe(15);
    expect(env.LOGIN_RATE_LIMIT_LOCKOUT_MINUTES).toBe(15);
    expect(env.OFFICE_TIMEZONE).toBe("Europe/Sofia");
  });

  it("throws EnvValidationError when a required variable is missing", () => {
    const { DATABASE_URL: _omit, ...rest } = validApiEnv;
    expect(() => parseApiEnv(rest)).toThrow(EnvValidationError);
  });

  it("rejects a non-Postgres DATABASE_URL", () => {
    expect(() => parseApiEnv({ ...validApiEnv, DATABASE_URL: "mysql://localhost/dho" })).toThrow(
      EnvValidationError,
    );
  });

  it("rejects a malformed token TTL", () => {
    expect(() => parseApiEnv({ ...validApiEnv, ACCESS_TOKEN_TTL: "fifteen minutes" })).toThrow(
      EnvValidationError,
    );
  });

  it("rejects identical access and refresh secrets", () => {
    expect(() =>
      parseApiEnv({ ...validApiEnv, JWT_REFRESH_SECRET: validApiEnv.JWT_ACCESS_SECRET }),
    ).toThrow(EnvValidationError);
  });

  it("reports every invalid field on the thrown error", () => {
    try {
      parseApiEnv({});
      expect.unreachable("parseApiEnv should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const envError = error as EnvValidationError;
      expect(Object.keys(envError.fieldErrors)).toEqual(
        expect.arrayContaining([
          "DATABASE_URL",
          "JWT_ACCESS_SECRET",
          "JWT_REFRESH_SECRET",
          "APP_ORIGIN",
          "API_ORIGIN",
        ]),
      );
    }
  });
});

describe("parseWebEnv", () => {
  it("parses a valid environment and applies documented defaults", () => {
    const env = parseWebEnv(validWebEnv);
    expect(env.PORT).toBe(3000);
  });

  it("throws EnvValidationError when NEXT_PUBLIC_API_ORIGIN is missing", () => {
    const { NEXT_PUBLIC_API_ORIGIN: _omit, ...rest } = validWebEnv;
    expect(() => parseWebEnv(rest)).toThrow(EnvValidationError);
  });
});
