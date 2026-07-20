import type { ApiEnv } from "@dho/config";

import { TokenService } from "./token.service";

function buildEnv(overrides: Partial<ApiEnv> = {}): ApiEnv {
  return {
    NODE_ENV: "test",
    PORT: 4000,
    DATABASE_URL: "postgresql://user:pass@localhost:5432/dho",
    JWT_ACCESS_SECRET: "access-secret-value-1234",
    JWT_REFRESH_SECRET: "refresh-secret-value-5678",
    ACCESS_TOKEN_TTL: "15m",
    REFRESH_TOKEN_TTL: "30d",
    APP_ORIGIN: "http://localhost:3000",
    API_ORIGIN: "http://localhost:4000",
    UPLOAD_ROOT: "./data/uploads",
    OFFICE_TIMEZONE: "Europe/Sofia",
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: 5,
    LOGIN_RATE_LIMIT_WINDOW_MINUTES: 15,
    LOGIN_RATE_LIMIT_LOCKOUT_MINUTES: 15,
    ...overrides,
  };
}

describe("TokenService", () => {
  it("signs and verifies an access token round-trip", () => {
    const service = new TokenService(buildEnv());
    const token = service.signAccessToken({ sub: "user-1", role: "ADMIN" });
    const payload = service.verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("ADMIN");
  });

  it("signs and verifies a refresh token round-trip", () => {
    const service = new TokenService(buildEnv());
    const token = service.signRefreshToken({ sub: "user-1", jti: "session-1" });
    const payload = service.verifyRefreshToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.jti).toBe("session-1");
  });

  it("rejects an access token verified against a different secret", () => {
    const issuer = new TokenService(buildEnv());
    const verifier = new TokenService(buildEnv({ JWT_ACCESS_SECRET: "a-totally-different-secret" }));
    const token = issuer.signAccessToken({ sub: "user-1", role: "MEMBER" });
    expect(() => verifier.verifyAccessToken(token)).toThrow();
  });

  it("rejects a refresh token presented as an access token", () => {
    const service = new TokenService(buildEnv());
    const refreshToken = service.signRefreshToken({ sub: "user-1", jti: "session-1" });
    expect(() => service.verifyAccessToken(refreshToken)).toThrow();
  });
});
