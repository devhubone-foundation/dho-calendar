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

describe("Public calendar (integration)", () => {
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

  it("requires no authentication and returns only public member fields", async () => {
    const member = await createTestUser(prisma, {
      fullName: "Ada Lovelace",
      qualificationBg: "Програмист",
      qualificationEn: "Programmer",
    });
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const monday = nextWeekdayOnOrAfter(today, 1);

    const response = await request(app.getHttpServer())
      .get(`/api/public/calendar?from=${monday}&to=${monday}`)
      .expect(200);

    const day = response.body.days.find((d: { date: string }) => d.date === monday);
    expect(day.isPublicOpenDay).toBe(true);
    expect(day.confirmedAttendees).toEqual([
      expect.objectContaining({
        fullName: "Ada Lovelace",
        qualificationBg: "Програмист",
        qualificationEn: "Programmer",
        contactEmail: member.email,
        slots: [{ startTime: "12:00", endTime: "20:00" }],
      }),
    ]);
    // No internal identifiers, audit data, or account/security fields.
    expect(day.confirmedAttendees[0]).not.toHaveProperty("id");
    expect(day.confirmedAttendees[0]).not.toHaveProperty("userId");
    expect(day.confirmedAttendees[0]).not.toHaveProperty("isActive");
    expect(day.confirmedAttendees[0]).not.toHaveProperty("mustChangePassword");
    expect(day.confirmedAttendees[0]).not.toHaveProperty("role");
    expect(response.body).not.toHaveProperty("warnings");
  });

  it("shows a Not-sure-only day as not publicly open, but keeps a same-date event visible", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const friday = nextWeekdayOnOrAfter(today, 5);

    await request(app.getHttpServer())
      .put(`/api/attendance/members/${admin.id}/exceptions/${friday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "NOT_SURE", slots: [{ startTime: "12:00", endTime: "16:00" }] })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        titleBg: "Уъркшоп",
        titleEn: "Workshop",
        descriptionBg: "Описание",
        descriptionEn: "Description",
        startAt: `${friday}T10:00:00.000Z`,
        endAt: `${friday}T12:00:00.000Z`,
        isAllDay: false,
        location: "DHO office",
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/public/calendar?from=${friday}&to=${friday}`)
      .expect(200);

    const day = response.body.days.find((d: { date: string }) => d.date === friday);
    expect(day.isPublicOpenDay).toBe(false);
    expect(day.confirmedAttendees).toEqual([]);
    expect(day.uncertainAttendees).toHaveLength(1);
    expect(response.body.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ titleEn: "Workshop" })]),
    );
  });

  it("excludes inactive members and NOT_ATTENDING members from both attendee lists", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);
    const inactiveMember = await createTestUser(prisma, { isActive: false });
    const absentMember = await createTestUser(prisma);
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const monday = nextWeekdayOnOrAfter(today, 1);

    await request(app.getHttpServer())
      .put(`/api/attendance/members/${absentMember.id}/exceptions/${monday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "NOT_ATTENDING", slots: [] })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/api/public/calendar?from=${monday}&to=${monday}`)
      .expect(200);

    const day = response.body.days.find((d: { date: string }) => d.date === monday);
    const emails = [...day.confirmedAttendees, ...day.uncertainAttendees].map(
      (m: { contactEmail: string }) => m.contactEmail,
    );
    expect(emails).not.toContain(inactiveMember.email);
    expect(emails).not.toContain(absentMember.email);
    // The admin still inherits the office defaults and should be confirmed.
    expect(emails).toContain(admin.email);
  });

  it("closes a specific date without hiding a same-date event, and leaves other Wednesdays open", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const adminToken = await login(app, admin.email, admin.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const wednesday = nextWeekdayOnOrAfter(today, 3);
    const laterWednesday = nextWeekdayOnOrAfter(
      new Date(new Date(`${wednesday}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      3,
    );

    await request(app.getHttpServer())
      .put(`/api/office-schedule/exceptions/${wednesday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isOpen: false, startTime: null, endTime: null })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        titleBg: "Затворен ден събитие",
        titleEn: "Closed-day event",
        descriptionBg: "Описание",
        descriptionEn: "Description",
        startAt: `${wednesday}T10:00:00.000Z`,
        endAt: `${wednesday}T12:00:00.000Z`,
        isAllDay: false,
        location: "DHO office",
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/public/calendar?from=${wednesday}&to=${laterWednesday}`)
      .expect(200);

    const closedDay = response.body.days.find((d: { date: string }) => d.date === wednesday);
    const otherWednesday = response.body.days.find((d: { date: string }) => d.date === laterWednesday);
    expect(closedDay).toMatchObject({ isPublicOpenDay: false, office: { isOpen: false, isChanged: true } });
    expect(otherWednesday).toMatchObject({ isPublicOpenDay: true, office: { isOpen: true, isChanged: false } });
    expect(response.body.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ titleEn: "Closed-day event" })]),
    );
  });

  it("clamps a partially out-of-hours attendee and omits one with zero overlap", async () => {
    const admin = await createTestUser(prisma, { role: "ADMIN" });
    const member = await createTestUser(prisma);
    const adminToken = await login(app, admin.email, admin.password);
    const memberToken = await login(app, member.email, member.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const monday = nextWeekdayOnOrAfter(today, 1);

    await request(app.getHttpServer())
      .put(`/api/attendance/me/exceptions/${monday}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ status: "ATTENDING", slots: [{ startTime: "09:00", endTime: "14:00" }] })
      .expect(200);
    // The admin inherits Monday 12:00-20:00 by default; push it fully outside
    // office hours so it should disappear from the public list entirely.
    await request(app.getHttpServer())
      .put(`/api/attendance/members/${admin.id}/exceptions/${monday}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ATTENDING", slots: [{ startTime: "07:00", endTime: "09:00" }] })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/api/public/calendar?from=${monday}&to=${monday}`)
      .expect(200);

    const day = response.body.days.find((d: { date: string }) => d.date === monday);
    expect(day.confirmedAttendees).toEqual([
      expect.objectContaining({
        contactEmail: member.email,
        slots: [{ startTime: "12:00", endTime: "14:00" }],
      }),
    ]);
    expect(day.confirmedAttendees.some((m: { contactEmail: string }) => m.contactEmail === admin.email)).toBe(
      false,
    );
    // Still publicly open — the member's clamped interval keeps them confirmed.
    expect(day.isPublicOpenDay).toBe(true);
  });

  it("publishes multiple attendance slots for one member on one date", async () => {
    const member = await createTestUser(prisma);
    const memberToken = await login(app, member.email, member.password);
    const today = todayInTimezone(OFFICE_TIMEZONE);
    const monday = nextWeekdayOnOrAfter(today, 1);

    await request(app.getHttpServer())
      .put(`/api/attendance/me/exceptions/${monday}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        status: "ATTENDING",
        slots: [
          { startTime: "13:00", endTime: "15:00" },
          { startTime: "16:00", endTime: "19:00" },
        ],
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/api/public/calendar?from=${monday}&to=${monday}`)
      .expect(200);

    const day = response.body.days.find((d: { date: string }) => d.date === monday);
    const entry = day.confirmedAttendees.find((m: { contactEmail: string }) => m.contactEmail === member.email);
    expect(entry.slots).toEqual([
      { startTime: "13:00", endTime: "15:00" },
      { startTime: "16:00", endTime: "19:00" },
    ]);
  });
});
