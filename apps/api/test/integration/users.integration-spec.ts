import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaClient } from "@dho/database";

import { createTestUser, resetDatabase } from "./db.util";
import { createTestApp } from "./test-app";

async function login(app: INestApplication, email: string, password: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Users / member management (integration)", () => {
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

  it("lets an admin create a member with a temporary password and role", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);

    const newMemberEmail = `new-member-${Date.now()}@test.local`;
    const response = await request(app.getHttpServer())
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: newMemberEmail,
        fullName: "Brand New Member",
        qualificationBg: "Нова роля",
        qualificationEn: "New role",
        role: "MEMBER",
        temporaryPassword: "temp-password-123",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      email: newMemberEmail,
      role: "MEMBER",
      isActive: true,
      mustChangePassword: true,
    });

    // The new member can log in with the temporary password.
    const memberToken = await login(app, newMemberEmail, "temp-password-123");
    expect(memberToken).toEqual(expect.any(String));
  });

  it("rejects creating a member with an email that is already in use (409 CONFLICT)", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);
    const existing = await createTestUser(prisma);

    const response = await request(app.getHttpServer())
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: existing.email,
        fullName: "Duplicate",
        qualificationBg: "Роля",
        qualificationEn: "Role",
        role: "MEMBER",
        temporaryPassword: "temp-password-123",
      })
      .expect(409);

    expect(response.body.code).toBe("CONFLICT");
  });

  it("lists members for an admin", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    await createTestUser(prisma);
    const adminToken = await login(app, admin.email, admin.password);

    const response = await request(app.getHttpServer())
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.members.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects a MEMBER hitting member-management endpoints with 403", async () => {
    const member = await createTestUser(prisma, { role: "MEMBER" });
    const memberToken = await login(app, member.email, member.password);

    await request(app.getHttpServer())
      .get("/api/users")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/users")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        email: "irrelevant@test.local",
        fullName: "Irrelevant",
        qualificationBg: "Роля",
        qualificationEn: "Role",
        role: "MEMBER",
        temporaryPassword: "temp-password-123",
      })
      .expect(403);
  });

  it("lets an admin edit a member's account and profile fields, and it persists", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);
    const member = await createTestUser(prisma);

    const updatedEmail = `renamed-${Date.now()}@test.local`;
    await request(app.getHttpServer())
      .patch(`/api/users/${member.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: updatedEmail,
        fullName: "Renamed Member",
        qualificationBg: "Обновена роля",
        qualificationEn: "Updated role",
        role: "MEMBER",
      })
      .expect(200);

    const fetched = await request(app.getHttpServer())
      .get(`/api/users/${member.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(fetched.body).toMatchObject({ email: updatedEmail, fullName: "Renamed Member" });
  });

  it("deactivating a member blocks login and future requests immediately", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);
    const member = await createTestUser(prisma);
    const memberToken = await login(app, member.email, member.password);

    await request(app.getHttpServer())
      .patch(`/api/users/${member.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    // A previously issued, still-unexpired access token is rejected immediately.
    await request(app.getHttpServer())
      .get("/api/me/profile")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(401);

    // And a fresh login attempt fails too.
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: member.email, password: member.password })
      .expect(401);
  });

  it("reactivating a member allows login again", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);
    const member = await createTestUser(prisma, { isActive: false });

    await request(app.getHttpServer())
      .patch(`/api/users/${member.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true })
      .expect(200);

    await login(app, member.email, member.password);
  });

  it("rejects an admin trying to deactivate their own account", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${admin.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});
