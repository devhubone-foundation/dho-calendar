import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaClient } from "@dho/database";

import { createTestUser, resetDatabase } from "./db.util";
import { createTestApp } from "./test-app";

function extractCookie(setCookie: string[] | undefined): string {
  const raw = setCookie?.find((cookie) => cookie.startsWith("dho_refresh_token="));
  if (!raw) {
    throw new Error("Expected a dho_refresh_token cookie to be set");
  }
  return raw.split(";")[0];
}

describe("Auth (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("logs in with a valid email/password and sets an httpOnly refresh cookie", async () => {
    const { email, password } = await createTestUser(prisma, { role: "ADMIN" });

    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({ email, role: "ADMIN", mustChangePassword: false });

    const cookies = response.headers["set-cookie"];
    expect(cookies?.[0]).toMatch(/dho_refresh_token=/);
    expect(cookies?.[0]).toMatch(/HttpOnly/i);
  });

  it("rejects an invalid password with the shared error shape", async () => {
    const { email } = await createTestUser(prisma);

    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: "definitely-wrong" })
      .expect(401);

    expect(response.body).toEqual({ code: "UNAUTHORIZED", message: expect.any(String) });
  });

  it("rejects a validation error (missing password) with VALIDATION_ERROR and fieldErrors", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "not-an-email" })
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.fieldErrors).toBeDefined();
  });

  it("locks the account after the configured number of failed attempts", async () => {
    const { email, password } = await createTestUser(prisma);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email, password: "wrong-password" })
        .expect(401);
    }

    const fifthAttempt = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: "wrong-password" })
      .expect(429);
    expect(fifthAttempt.body.code).toBe("RATE_LIMITED");

    const stillLockedWithCorrectPassword = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password })
      .expect(429);
    expect(stillLockedWithCorrectPassword.body.code).toBe("RATE_LIMITED");
  });

  it("blocks a non-exempt endpoint while mustChangePassword is true, then unblocks it after changing the password", async () => {
    const { email, password } = await createTestUser(prisma, {
      role: "ADMIN",
      mustChangePassword: true,
    });

    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login.body.user.mustChangePassword).toBe(true);
    const accessToken = login.body.accessToken as string;

    // /auth/me stays reachable so the UI can render the change-password screen.
    await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // Any ordinary protected endpoint is blocked until the password changes.
    const blocked = await request(app.getHttpServer())
      .get("/api/audit")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);
    expect(blocked.body.code).toBe("FORBIDDEN");

    await request(app.getHttpServer())
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: password, newPassword: "a-brand-new-password" })
      .expect(200);

    // Re-using the *same still-valid* access token now succeeds: the guard
    // re-reads mustChangePassword from the database on every request.
    await request(app.getHttpServer())
      .get("/api/audit")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
  });

  it("rotates the refresh token and rejects reuse of an already-rotated token", async () => {
    const { email, password } = await createTestUser(prisma);

    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);
    const originalCookie = extractCookie(login.headers["set-cookie"]);

    const refreshed = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", originalCookie)
      .expect(200);
    const rotatedCookie = extractCookie(refreshed.headers["set-cookie"]);
    expect(rotatedCookie).not.toBe(originalCookie);

    // Replaying the original, now-revoked cookie must fail...
    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", originalCookie)
      .expect(401);

    // ...and because reuse looks like theft, the rotated session is revoked too.
    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", rotatedCookie)
      .expect(401);
  });

  it("revokes the session on logout so the refresh cookie can no longer be used", async () => {
    const { email, password } = await createTestUser(prisma);

    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);
    const cookie = extractCookie(login.headers["set-cookie"]);

    await request(app.getHttpServer()).post("/api/auth/logout").set("Cookie", cookie).expect(200);

    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", cookie)
      .expect(401);
  });
});
