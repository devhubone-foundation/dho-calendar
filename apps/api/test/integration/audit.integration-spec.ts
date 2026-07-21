import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaClient } from "@dho/database";

import { AuditCleanupService } from "../../src/audit/audit-cleanup.service";
import { createTestUser, resetDatabase } from "./db.util";
import { createTestApp } from "./test-app";

async function login(app: INestApplication, email: string, password: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Audit (integration)", () => {
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

  it("rejects a MEMBER reading the audit history (403) and allows an ADMIN (200)", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const member = await createTestUser(prisma);
    const adminToken = await login(app, admin.email, admin.password);
    const memberToken = await login(app, member.email, member.password);

    await request(app.getHttpServer())
      .get("/api/audit")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(403);

    // The login itself and the member-creation above already produced
    // entries; deactivating the member produces one more we can assert on.
    await request(app.getHttpServer())
      .patch(`/api/users/${member.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/audit")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(
      response.body.entries.some(
        (entry: { action: string; targetId: string }) =>
          entry.action === "member.deactivated" && entry.targetId === member.id,
      ),
    ).toBe(true);
  });

  it("never returns an entry older than the seven-day retention window", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);

    const expired = await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "member.updated",
        targetType: "User",
        targetId: admin.id,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app.getHttpServer())
      .get("/api/audit")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.entries.some((entry: { id: string }) => entry.id === expired.id)).toBe(false);
  });

  it("permanently deletes expired records when the cleanup job runs", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const expired = await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "member.updated",
        targetType: "User",
        targetId: admin.id,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    });
    const recent = await prisma.auditLog.create({
      data: { actorId: admin.id, action: "member.updated", targetType: "User", targetId: admin.id },
    });

    const cleanup = app.get(AuditCleanupService);
    await cleanup.handleCleanup();

    const remaining = await prisma.auditLog.findMany({ where: { id: { in: [expired.id, recent.id] } } });
    expect(remaining.map((row) => row.id)).toEqual([recent.id]);
  });
});
