import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaClient } from "@dho/database";

import { createTestUser, resetDatabase } from "./db.util";
import { createTestApp } from "./test-app";

describe("Authorization (integration)", () => {
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

  it("rejects an unauthenticated request with 401 in the shared error shape", async () => {
    const response = await request(app.getHttpServer()).get("/api/audit").expect(401);
    expect(response.body).toEqual({ code: "UNAUTHORIZED", message: expect.any(String) });
  });

  it("rejects a MEMBER on an ADMIN-only route with 403 in the shared error shape", async () => {
    const { email, password } = await createTestUser(prisma, { role: "MEMBER" });
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/audit")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(403);
    expect(response.body).toEqual({ code: "FORBIDDEN", message: expect.any(String) });
  });

  it("allows an ADMIN on the ADMIN-only route", async () => {
    const { email, password } = await createTestUser(prisma, { role: "ADMIN" });
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/audit")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("rejects an inactive user even with a previously valid access token", async () => {
    const { email, password, id } = await createTestUser(prisma, { role: "MEMBER" });
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);

    await prisma.user.update({ where: { id }, data: { isActive: false } });

    await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(401);
  });
});
