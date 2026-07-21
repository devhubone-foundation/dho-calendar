import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaClient } from "@dho/database";
import sharp from "sharp";

import { createTestUser, resetDatabase } from "./db.util";
import { createTestApp } from "./test-app";

async function makePng(size = 16): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 10, g: 100, b: 200 } },
  })
    .png()
    .toBuffer();
}

async function login(app: INestApplication, email: string, password: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Profiles (integration)", () => {
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

  it("returns the caller's own profile", async () => {
    const { email, password } = await createTestUser(prisma, {
      fullName: "Ada Lovelace",
      qualificationEn: "Programmer",
    });
    const accessToken = await login(app, email, password);

    const response = await request(app.getHttpServer())
      .get("/api/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      email,
      fullName: "Ada Lovelace",
      qualificationEn: "Programmer",
    });
  });

  it("updates and persists the caller's own profile, including the login email", async () => {
    const { email, password } = await createTestUser(prisma);
    const accessToken = await login(app, email, password);

    const newEmail = `updated-${Date.now()}@test.local`;
    const update = await request(app.getHttpServer())
      .patch("/api/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "New Name",
        email: newEmail,
        qualificationBg: "Нова роля",
        qualificationEn: "New role",
      })
      .expect(200);

    expect(update.body).toMatchObject({ email: newEmail, fullName: "New Name" });

    // Persistence: re-fetching (with a fresh login using the NEW email) shows
    // the update, and login still works after the email change.
    const newAccessToken = await login(app, newEmail, password);
    const refetched = await request(app.getHttpServer())
      .get("/api/me/profile")
      .set("Authorization", `Bearer ${newAccessToken}`)
      .expect(200);
    expect(refetched.body).toMatchObject({ email: newEmail, fullName: "New Name" });
  });

  it("rejects an email change that collides with another account (409 CONFLICT)", async () => {
    const other = await createTestUser(prisma, { email: `taken-${Date.now()}@test.local` });
    const { email, password } = await createTestUser(prisma);
    const accessToken = await login(app, email, password);

    const response = await request(app.getHttpServer())
      .patch("/api/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Someone",
        email: other.email,
        qualificationBg: "Роля",
        qualificationEn: "Role",
      })
      .expect(409);

    expect(response.body.code).toBe("CONFLICT");
    expect(response.body.fieldErrors?.email).toBeDefined();
  });

  it("uploads a valid profile picture and persists the relative path", async () => {
    const { email, password } = await createTestUser(prisma);
    const accessToken = await login(app, email, password);
    const png = await makePng();

    const response = await request(app.getHttpServer())
      .post("/api/me/profile/picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", png, { filename: "avatar.png", contentType: "image/png" })
      .expect(201);

    expect(response.body.profileImagePath).toMatch(/^profiles\/[0-9a-f-]{36}\.webp$/);

    const profile = await request(app.getHttpServer())
      .get("/api/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(profile.body.profileImagePath).toBe(response.body.profileImagePath);

    const served = await request(app.getHttpServer())
      .get(`/api/uploads/${response.body.profileImagePath}`)
      .expect(200);
    expect(served.headers["content-type"]).toMatch(/image\/webp/);
  });

  it("replaces a previous profile picture, and the old file is no longer served", async () => {
    const { email, password } = await createTestUser(prisma);
    const accessToken = await login(app, email, password);

    const first = await request(app.getHttpServer())
      .post("/api/me/profile/picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", await makePng(), { filename: "first.png", contentType: "image/png" })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post("/api/me/profile/picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", await makePng(32), { filename: "second.png", contentType: "image/png" })
      .expect(201);

    expect(second.body.profileImagePath).not.toBe(first.body.profileImagePath);

    await request(app.getHttpServer()).get(`/api/uploads/${second.body.profileImagePath}`).expect(200);
    await request(app.getHttpServer()).get(`/api/uploads/${first.body.profileImagePath}`).expect(404);
  });

  it("rejects an oversized upload with a clean validation error", async () => {
    const { email, password } = await createTestUser(prisma);
    const accessToken = await login(app, email, password);
    const oversized = Buffer.alloc(6 * 1024 * 1024, 1);

    const response = await request(app.getHttpServer())
      .post("/api/me/profile/picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", oversized, { filename: "big.png", contentType: "image/png" })
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-image file even with an image content-type", async () => {
    const { email, password } = await createTestUser(prisma);
    const accessToken = await login(app, email, password);
    const notAnImage = Buffer.from("not a real image");

    const response = await request(app.getHttpServer())
      .post("/api/me/profile/picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", notAnImage, { filename: "fake.png", contentType: "image/png" })
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects path traversal in the upload filename URL", async () => {
    await request(app.getHttpServer()).get("/api/uploads/profiles/..%2F..%2Fpackage.json").expect(404);
  });
});
