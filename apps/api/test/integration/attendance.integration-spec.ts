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

describe("Attendance (integration)", () => {
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

  it("a new member inherits the office defaults as their personal weekly schedule", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);

    const response = await request(app.getHttpServer())
      .get("/api/attendance/me/weekly")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          weekday: "MONDAY",
          attends: true,
          startTime: "12:00",
          endTime: "20:00",
          isInherited: true,
        }),
        expect.objectContaining({ weekday: "TUESDAY", attends: false, isInherited: true }),
      ]),
    );
  });

  it("a member can edit their own weekly schedule; other weekdays stay inherited", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);

    const update = await request(app.getHttpServer())
      .patch("/api/attendance/me/weekly")
      .set("Authorization", `Bearer ${token}`)
      .send({ days: [{ weekday: "WEDNESDAY", attends: true, startTime: "14:00", endTime: "18:00" }] })
      .expect(200);

    expect(update.body.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ weekday: "WEDNESDAY", startTime: "14:00", endTime: "18:00", isInherited: false }),
        expect.objectContaining({ weekday: "MONDAY", startTime: "12:00", endTime: "20:00", isInherited: true }),
        expect.objectContaining({ weekday: "FRIDAY", startTime: "12:00", endTime: "20:00", isInherited: true }),
      ]),
    );

    // Persists across a fresh read.
    const refetched = await request(app.getHttpServer())
      .get("/api/attendance/me/weekly")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(refetched.body.days).toEqual(
      expect.arrayContaining([expect.objectContaining({ weekday: "WEDNESDAY", startTime: "14:00", endTime: "18:00" })]),
    );
  });

  it("a member's date exception overrides only that date, leaving future weekly defaults intact", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const friday = nextWeekdayOnOrAfter(today, 5);
    const laterFriday = nextWeekdayOnOrAfter(
      new Date(new Date(`${friday}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      5,
    );

    await request(app.getHttpServer())
      .put(`/api/attendance/me/exceptions/${friday}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "NOT_ATTENDING", startTime: null, endTime: null })
      .expect(200);

    const effective = await request(app.getHttpServer())
      .get(`/api/attendance/me/effective?from=${friday}&to=${laterFriday}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const exceptionDay = effective.body.days.find((d: { date: string }) => d.date === friday);
    const otherFriday = effective.body.days.find((d: { date: string }) => d.date === laterFriday);
    expect(exceptionDay).toMatchObject({ status: "NOT_ATTENDING" });
    expect(otherFriday).toMatchObject({ status: "ATTENDING", enteredStartTime: "12:00", enteredEndTime: "20:00" });
  });

  it("rejects invalid attendance intervals: hours required for ATTENDING/NOT_SURE, forbidden for NOT_ATTENDING", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);

    const missingHours = await request(app.getHttpServer())
      .put(`/api/attendance/me/exceptions/${today}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ATTENDING", startTime: null, endTime: null })
      .expect(400);
    expect(missingHours.body.code).toBe("VALIDATION_ERROR");

    const notSureMissingHours = await request(app.getHttpServer())
      .put(`/api/attendance/me/exceptions/${today}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "NOT_SURE", startTime: null, endTime: null })
      .expect(400);
    expect(notSureMissingHours.body.code).toBe("VALIDATION_ERROR");

    const strayHours = await request(app.getHttpServer())
      .put(`/api/attendance/me/exceptions/${today}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "NOT_ATTENDING", startTime: "12:00", endTime: "13:00" })
      .expect(400);
    expect(strayHours.body.code).toBe("VALIDATION_ERROR");

    const endBeforeStart = await request(app.getHttpServer())
      .put(`/api/attendance/me/exceptions/${today}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ATTENDING", startTime: "18:00", endTime: "12:00" })
      .expect(400);
    expect(endBeforeStart.body.code).toBe("VALIDATION_ERROR");
  });

  it("stores out-of-hours attendance as entered and reports the clamped public interval", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const monday = nextWeekdayOnOrAfter(today, 1);

    // Partial overlap: entered 09:00-14:00 against office hours 12:00-20:00.
    await request(app.getHttpServer())
      .put(`/api/attendance/me/exceptions/${monday}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ATTENDING", startTime: "09:00", endTime: "14:00" })
      .expect(200);

    const partial = await request(app.getHttpServer())
      .get(`/api/attendance/me/effective?from=${monday}&to=${monday}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(partial.body.days[0]).toMatchObject({
      enteredStartTime: "09:00",
      enteredEndTime: "14:00",
      publicStartTime: "12:00",
      publicEndTime: "14:00",
      isClamped: true,
    });

    // No overlap at all: entered 07:00-09:00, office opens at 12:00.
    await request(app.getHttpServer())
      .put(`/api/attendance/me/exceptions/${monday}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ATTENDING", startTime: "07:00", endTime: "09:00" })
      .expect(200);

    const noOverlap = await request(app.getHttpServer())
      .get(`/api/attendance/me/effective?from=${monday}&to=${monday}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(noOverlap.body.days[0]).toMatchObject({
      enteredStartTime: "07:00",
      enteredEndTime: "09:00",
      publicStartTime: null,
      publicEndTime: null,
      isClamped: true,
    });
  });

  it("lets an admin manage any member's attendance, and rejects a member touching another member's attendance (403)", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const member = await createTestUser(prisma);
    const otherMember = await createTestUser(prisma);
    const adminToken = await login(app, admin.email, admin.password);
    const memberToken = await login(app, member.email, member.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);

    await request(app.getHttpServer())
      .get(`/api/attendance/members/${member.id}/weekly`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/attendance/members/${member.id}/weekly`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ days: [{ weekday: "TUESDAY", attends: true, startTime: "10:00", endTime: "12:00" }] })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/attendance/members/${member.id}/exceptions/${today}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "NOT_SURE", startTime: "12:00", endTime: "16:00" })
      .expect(200);

    // A plain member cannot reach another member's attendance endpoints at all.
    await request(app.getHttpServer())
      .get(`/api/attendance/members/${otherMember.id}/weekly`)
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/attendance/members/${otherMember.id}/weekly`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ days: [{ weekday: "TUESDAY", attends: true, startTime: "10:00", endTime: "12:00" }] })
      .expect(403);

    await request(app.getHttpServer())
      .put(`/api/attendance/members/${otherMember.id}/exceptions/${today}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ status: "NOT_SURE", startTime: "12:00", endTime: "16:00" })
      .expect(403);
  });

  it("warns on an upcoming open working day with no confirmed attendee, including a Not-sure-only day, and never for a closed day", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const member = await createTestUser(prisma);
    const adminToken = await login(app, admin.email, admin.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const friday = nextWeekdayOnOrAfter(today, 5);
    const monday = nextWeekdayOnOrAfter(today, 1);

    // Nobody attending on this Friday at all.
    await request(app.getHttpServer())
      .put(`/api/attendance/members/${admin.id}/exceptions/${friday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "NOT_ATTENDING", startTime: null, endTime: null })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/attendance/members/${member.id}/exceptions/${friday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "NOT_SURE", startTime: "12:00", endTime: "16:00" })
      .expect(200);

    // Close Monday entirely — should never warn regardless of attendance.
    await request(app.getHttpServer())
      .put(`/api/office-schedule/exceptions/${monday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isOpen: false, startTime: null, endTime: null })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/attendance/members/${admin.id}/exceptions/${monday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "NOT_ATTENDING", startTime: null, endTime: null })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/attendance/members/${member.id}/exceptions/${monday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "NOT_ATTENDING", startTime: null, endTime: null })
      .expect(200);

    const warnings = await request(app.getHttpServer())
      .get("/api/attendance/warnings")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const fridayWarning = warnings.body.warnings.find((w: { date: string }) => w.date === friday);
    expect(fridayWarning).toMatchObject({ date: friday, reason: "ONLY_UNCERTAIN_OR_ABSENT" });
    expect(warnings.body.warnings.some((w: { date: string }) => w.date === monday)).toBe(false);
  });

  it("does not warn when at least one active member is confirmed ATTENDING", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);
    // A fresh admin with no overrides inherits ATTENDING on Monday/Wed/Fri
    // from the office defaults, so the nearest such day should never warn.
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const friday = nextWeekdayOnOrAfter(today, 5);

    const warnings = await request(app.getHttpServer())
      .get("/api/attendance/warnings")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(warnings.body.warnings.some((w: { date: string }) => w.date === friday)).toBe(false);
  });

  it("rejects a MEMBER reading the coverage warnings (403)", async () => {
    const member = await createTestUser(prisma);
    const memberToken = await login(app, member.email, member.password);

    await request(app.getHttpServer())
      .get("/api/attendance/warnings")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(403);
  });
});
