import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaClient } from "@dho/database";
import sharp from "sharp";

import { createTestUser, resetDatabase } from "./db.util";
import { createTestApp } from "./test-app";

function addDaysIso(date: string, amount: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

/** Next date on or after `date` that falls on `targetJsDay` (Sunday=0). */
function nextWeekdayOnOrAfter(date: string, targetJsDay: number): string {
  let cursor = date;
  while (new Date(`${cursor}T00:00:00.000Z`).getUTCDay() !== targetJsDay) {
    cursor = addDaysIso(cursor, 1);
  }
  return cursor;
}

async function makePng(width = 40, height = 40): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 20, g: 120, b: 60 } } })
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

describe("Events (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  // A Monday comfortably in the future, so 3-month-horizon clamping never
  // excludes it regardless of when the suite runs.
  let monday: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();
    const today = new Date().toISOString().slice(0, 10);
    monday = nextWeekdayOnOrAfter(addDaysIso(today, 14), 1);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("creates a bilingual one-time event and returns it in a range query", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);

    const create = await request(app.getHttpServer())
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        titleBg: "Работилница",
        titleEn: "Workshop",
        descriptionBg: "Описание",
        descriptionEn: "Description",
        startAt: `${monday}T09:00:00.000Z`,
        endAt: `${monday}T11:00:00.000Z`,
        isAllDay: false,
        location: "DevHubOne office",
      })
      .expect(201);

    expect(create.body.titleBg).toBe("Работилница");
    expect(create.body.titleEn).toBe("Workshop");

    const range = await request(app.getHttpServer())
      .get(`/api/events?from=${monday}&to=${addDaysIso(monday, 7)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(range.body.occurrences).toHaveLength(1);
    expect(range.body.occurrences[0]).toMatchObject({
      seriesId: create.body.id,
      titleEn: "Workshop",
      isRecurring: false,
    });

    const auditEntry = await prisma.auditLog.findFirst({ where: { targetId: create.body.id } });
    expect(auditEntry).toMatchObject({ actorId: member.id, action: "event.created" });
  });

  it("lets a different member edit and delete someone else's event, audited under the actor", async () => {
    const memberA = await createTestUser(prisma, { email: `a-${Date.now()}@test.local` });
    const memberB = await createTestUser(prisma, { email: `b-${Date.now()}@test.local` });
    const tokenA = await login(app, memberA.email, memberA.password);
    const tokenB = await login(app, memberB.email, memberB.password);

    const create = await request(app.getHttpServer())
      .post("/api/events")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(baseEventBody(monday))
      .expect(201);

    const update = await request(app.getHttpServer())
      .patch(`/api/events/${create.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ ...baseEventBody(monday), titleEn: "Updated by B", expectedUpdatedAt: create.body.updatedAt })
      .expect(200);
    expect(update.body.titleEn).toBe("Updated by B");

    const editAudit = await prisma.auditLog.findFirst({
      where: { targetId: create.body.id, action: "event.updated" },
    });
    expect(editAudit).toMatchObject({ actorId: memberB.id });

    await request(app.getHttpServer())
      .delete(`/api/events/${create.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ expectedUpdatedAt: update.body.updatedAt })
      .expect(200);

    const deleteAudit = await prisma.auditLog.findFirst({
      where: { targetId: create.body.id, action: "event.deleted" },
    });
    expect(deleteAudit).toMatchObject({ actorId: memberB.id, metadata: expect.objectContaining({ scope: "SERIES" }) });

    const range = await request(app.getHttpServer())
      .get(`/api/events?from=${monday}&to=${addDaysIso(monday, 7)}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(range.body.occurrences).toHaveLength(0);
  });

  it("returns 409 CONFLICT on a stale edit and does not apply it", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);

    const create = await request(app.getHttpServer())
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send(baseEventBody(monday))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/events/${create.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseEventBody(monday), titleEn: "First edit", expectedUpdatedAt: create.body.updatedAt })
      .expect(200);

    // Retrying with the now-stale original updatedAt must conflict.
    const stale = await request(app.getHttpServer())
      .patch(`/api/events/${create.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseEventBody(monday), titleEn: "Stale edit", expectedUpdatedAt: create.body.updatedAt })
      .expect(409);
    expect(stale.body.code).toBe("CONFLICT");

    const detail = await request(app.getHttpServer())
      .get(`/api/events/${create.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(detail.body.titleEn).toBe("First edit");
  });

  it("expands a weekly recurring event over the requested range", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);

    await request(app.getHttpServer())
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...baseEventBody(monday),
        recurrence: { byWeekdays: ["MONDAY"], end: { type: "COUNT", count: 4 } },
      })
      .expect(201);

    const range = await request(app.getHttpServer())
      .get(`/api/events?from=${monday}&to=${addDaysIso(monday, 30)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const dates = range.body.occurrences.map((o: { occurrenceDate: string }) => o.occurrenceDate);
    expect(dates).toEqual([monday, addDaysIso(monday, 7), addDaysIso(monday, 14), addDaysIso(monday, 21)]);
    expect(range.body.occurrences.every((o: { isRecurring: boolean }) => o.isRecurring)).toBe(true);
  });

  it("supports the three edit/delete scopes: this occurrence, this+future (preserving the past), and entire series", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);

    const create = await request(app.getHttpServer())
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...baseEventBody(monday),
        recurrence: { byWeekdays: ["MONDAY"], end: { type: "COUNT", count: 6 } },
      })
      .expect(201);
    const seriesId = create.body.id;

    const week2 = addDaysIso(monday, 7);
    const week3 = addDaysIso(monday, 14);
    const week4 = addDaysIso(monday, 21);

    // Scope 1: this occurrence only — edit week 2, others unaffected.
    await request(app.getHttpServer())
      .put(`/api/events/${seriesId}/occurrences/${week2}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseEventBody(monday), titleEn: "Moved topic", expectedUpdatedAt: null })
      .expect(200);

    let range = await request(app.getHttpServer())
      .get(`/api/events?from=${monday}&to=${addDaysIso(monday, 60)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    let byDate = indexByDate(range.body.occurrences);
    expect(byDate[monday].titleEn).toBe("Workshop");
    expect(byDate[week2].titleEn).toBe("Moved topic");
    expect(byDate[week2].isException).toBe(true);
    expect(byDate[week3].titleEn).toBe("Workshop");

    // Scope 2: this and future, starting week 3 — week 1 & 2 (past for the
    // split) stay exactly as they are; week 3 onward gets the new title.
    const seriesDetail = await request(app.getHttpServer())
      .get(`/api/events/${seriesId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const split = await request(app.getHttpServer())
      .patch(`/api/events/${seriesId}/occurrences/${week3}/future`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...baseEventBody(week3),
        titleEn: "Rebranded series",
        expectedUpdatedAt: seriesDetail.body.updatedAt,
      })
      .expect(200);
    const newSeriesId = split.body.id;
    expect(newSeriesId).not.toBe(seriesId);

    range = await request(app.getHttpServer())
      .get(`/api/events?from=${monday}&to=${addDaysIso(monday, 60)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    byDate = indexByDate(range.body.occurrences);
    // Past preserved exactly.
    expect(byDate[monday]).toMatchObject({ titleEn: "Workshop", seriesId });
    expect(byDate[week2]).toMatchObject({ titleEn: "Moved topic", seriesId });
    // This-and-future changed, now on the new series.
    expect(byDate[week3]).toMatchObject({ titleEn: "Rebranded series", seriesId: newSeriesId });
    expect(byDate[week4]).toMatchObject({ titleEn: "Rebranded series", seriesId: newSeriesId });

    // Scope 3: entire series delete removes all remaining occurrences of
    // that segment, but not the other (original) segment's past occurrences.
    await request(app.getHttpServer())
      .delete(`/api/events/${newSeriesId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ expectedUpdatedAt: split.body.updatedAt })
      .expect(200);

    range = await request(app.getHttpServer())
      .get(`/api/events?from=${monday}&to=${addDaysIso(monday, 60)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    byDate = indexByDate(range.body.occurrences);
    expect(byDate[monday]).toBeDefined();
    expect(byDate[week2]).toBeDefined();
    expect(byDate[week3]).toBeUndefined();
    expect(byDate[week4]).toBeUndefined();
  });

  it("shows a fallback-friendly null cover by default, uploads/serves a cover, and removes its file on delete", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);

    const create = await request(app.getHttpServer())
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send(baseEventBody(monday))
      .expect(201);
    expect(create.body.coverImagePath).toBeNull();

    const upload = await request(app.getHttpServer())
      .post(`/api/events/${create.body.id}/cover`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", await makePng(), { filename: "cover.png", contentType: "image/png" })
      .expect(201);
    expect(upload.body.coverImagePath).toMatch(/^events\/[0-9a-f-]{36}\.webp$/);

    const served = await request(app.getHttpServer())
      .get(`/api/uploads/${upload.body.coverImagePath}`)
      .expect(200);
    expect(served.headers["content-type"]).toMatch(/image\/webp/);

    const detail = await request(app.getHttpServer())
      .get(`/api/events/${create.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/events/${create.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ expectedUpdatedAt: detail.body.updatedAt })
      .expect(200);

    await request(app.getHttpServer()).get(`/api/uploads/${upload.body.coverImagePath}`).expect(404);
  });

  it("rejects an oversized cover upload with a clean validation error", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);

    const create = await request(app.getHttpServer())
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send(baseEventBody(monday))
      .expect(201);

    const oversized = Buffer.alloc(11 * 1024 * 1024, 1);
    const response = await request(app.getHttpServer())
      .post(`/api/events/${create.body.id}/cover`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", oversized, { filename: "big.png", contentType: "image/png" })
      .expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("renders a multi-day all-day event across the days it spans", async () => {
    const member = await createTestUser(prisma);
    const token = await login(app, member.email, member.password);
    const startDate = monday;
    const endDate = addDaysIso(monday, 2); // 3-day span (inclusive)

    await request(app.getHttpServer())
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...baseEventBody(monday),
        isAllDay: true,
        startAt: `${startDate}T00:00:00.000Z`,
        endAt: `${addDaysIso(endDate, 1)}T00:00:00.000Z`, // exclusive end
      })
      .expect(201);

    const dayInMiddle = addDaysIso(monday, 1);
    const range = await request(app.getHttpServer())
      .get(`/api/events?from=${dayInMiddle}&to=${dayInMiddle}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(range.body.occurrences).toHaveLength(1);
    expect(range.body.occurrences[0].isAllDay).toBe(true);

    const before = await request(app.getHttpServer())
      .get(`/api/events?from=${addDaysIso(startDate, -1)}&to=${addDaysIso(startDate, -1)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(before.body.occurrences).toHaveLength(0);
  });
});

function baseEventBody(startDate: string) {
  return {
    titleBg: "Работилница",
    titleEn: "Workshop",
    descriptionBg: "Описание",
    descriptionEn: "Description",
    startAt: `${startDate}T09:00:00.000Z`,
    endAt: `${startDate}T11:00:00.000Z`,
    isAllDay: false,
    location: "DevHubOne office",
  };
}

function indexByDate(
  occurrences: { occurrenceDate: string; titleEn: string; seriesId: string; isException: boolean }[],
): Record<string, { occurrenceDate: string; titleEn: string; seriesId: string; isException: boolean }> {
  return Object.fromEntries(occurrences.map((o) => [o.occurrenceDate, o]));
}
