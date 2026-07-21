import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaClient } from "@dho/database";

import { todayInTimezone } from "../../src/common/calendar-date.util";
import { createTestUser, resetDatabase, seedOfficeDefaults } from "./db.util";
import { createTestApp } from "./test-app";

const OFFICE_TIMEZONE = "Europe/Sofia";

function nextWeekdayOnOrAfter(date: string, targetJsDay: number): string {
  let cursor = date;
  while (new Date(`${cursor}T00:00:00.000Z`).getUTCDay() !== targetJsDay) {
    const d = new Date(`${cursor}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return cursor;
}

async function login(app: INestApplication, email: string, password: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Office schedule (integration)", () => {
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
    await seedOfficeDefaults(prisma);
  });

  it("returns the seeded Mon/Wed/Fri 12:00-20:00 defaults to any authenticated member", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);

    const response = await request(app.getHttpServer())
      .get("/api/office-schedule/defaults")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ weekday: "MONDAY", isOpen: true, startTime: "12:00", endTime: "20:00" }),
        expect.objectContaining({ weekday: "TUESDAY", isOpen: false, startTime: null, endTime: null }),
        expect.objectContaining({ weekday: "WEDNESDAY", isOpen: true, startTime: "12:00", endTime: "20:00" }),
      ]),
    );
  });

  it("rejects a MEMBER changing office defaults with 403, but persists an ADMIN's change future-only", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const member = await createTestUser(prisma);
    const adminToken = await login(app, admin.email, admin.password);
    const memberToken = await login(app, member.email, member.password);

    await request(app.getHttpServer())
      .patch("/api/office-schedule/defaults")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ days: [{ weekday: "WEDNESDAY", isOpen: true, startTime: "14:00", endTime: "18:00" }] })
      .expect(403);

    const updateResponse = await request(app.getHttpServer())
      .patch("/api/office-schedule/defaults")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ days: [{ weekday: "WEDNESDAY", isOpen: true, startTime: "14:00", endTime: "18:00" }] })
      .expect(200);

    expect(updateResponse.body.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ weekday: "WEDNESDAY", startTime: "14:00", endTime: "18:00" }),
        expect.objectContaining({ weekday: "MONDAY", startTime: "12:00", endTime: "20:00" }),
      ]),
    );

    // A clearly-historical Wednesday keeps the original hours (future-only change).
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const future = await request(app.getHttpServer())
      .get(`/api/office-schedule/effective?from=2020-06-03&to=2020-06-03`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(future.body.days[0]).toMatchObject({ isOpen: true, startTime: "12:00", endTime: "20:00" });

    // Today (and future Wednesdays) use the new hours.
    const nextWednesday = nextWeekdayOnOrAfter(today, 3);
    const present = await request(app.getHttpServer())
      .get(`/api/office-schedule/effective?from=${nextWednesday}&to=${nextWednesday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(present.body.days[0]).toMatchObject({ isOpen: true, startTime: "14:00", endTime: "18:00" });
  });

  it("an admin date exception closes a single Wednesday without touching other Wednesdays", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);

    const today = todayInTimezone(OFFICE_TIMEZONE);
    const closedWednesday = nextWeekdayOnOrAfter(today, 3);
    const laterWednesday = nextWeekdayOnOrAfter(
      new Date(new Date(`${closedWednesday}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      3,
    );

    await request(app.getHttpServer())
      .put(`/api/office-schedule/exceptions/${closedWednesday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isOpen: false, startTime: null, endTime: null })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/api/office-schedule/effective?from=${closedWednesday}&to=${laterWednesday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const closedDay = response.body.days.find((d: { date: string }) => d.date === closedWednesday);
    const laterDay = response.body.days.find((d: { date: string }) => d.date === laterWednesday);
    expect(closedDay).toMatchObject({ isOpen: false, source: "EXCEPTION" });
    expect(laterDay).toMatchObject({ isOpen: true, startTime: "12:00", endTime: "20:00", source: "DEFAULT" });
  });

  it("opens a normally-closed Tuesday for one date with custom hours, then deleting the exception reverts it", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const tuesday = nextWeekdayOnOrAfter(today, 2);

    await request(app.getHttpServer())
      .put(`/api/office-schedule/exceptions/${tuesday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isOpen: true, startTime: "10:00", endTime: "16:00" })
      .expect(200);

    const opened = await request(app.getHttpServer())
      .get(`/api/office-schedule/effective?from=${tuesday}&to=${tuesday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(opened.body.days[0]).toMatchObject({ isOpen: true, startTime: "10:00", endTime: "16:00" });

    await request(app.getHttpServer())
      .delete(`/api/office-schedule/exceptions/${tuesday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const reverted = await request(app.getHttpServer())
      .get(`/api/office-schedule/effective?from=${tuesday}&to=${tuesday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(reverted.body.days[0]).toMatchObject({ isOpen: false, source: "DEFAULT" });
  });

  it("rejects a MEMBER creating/deleting exceptions with 403", async () => {
    const member = await createTestUser(prisma);
    const memberToken = await login(app, member.email, member.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);

    await request(app.getHttpServer())
      .put(`/api/office-schedule/exceptions/${today}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ isOpen: false, startTime: null, endTime: null })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/office-schedule/exceptions/${today}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(403);
  });

  it("rejects an invalid exception body with 400 VALIDATION_ERROR", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);

    const response = await request(app.getHttpServer())
      .put(`/api/office-schedule/exceptions/${today}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isOpen: true, startTime: null, endTime: null })
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});
