import { PublicCalendarService } from "./public-calendar.service";

const env = { OFFICE_TIMEZONE: "Europe/Sofia" } as never;

function makeService(overrides: {
  officeDays?: unknown[];
  memberDays?: unknown[];
  occurrences?: unknown[];
  users?: unknown[];
}) {
  const officeSchedule = { resolveRange: jest.fn().mockResolvedValue(overrides.officeDays ?? []) } as never;
  const attendance = {
    resolveActiveMembersForRange: jest.fn().mockResolvedValue(overrides.memberDays ?? []),
  } as never;
  const events = {
    listRange: jest.fn().mockResolvedValue({ occurrences: overrides.occurrences ?? [] }),
  } as never;
  const prisma = { user: { findMany: jest.fn().mockResolvedValue(overrides.users ?? []) } } as never;

  return new PublicCalendarService(prisma, officeSchedule, attendance, events, env);
}

const activeUser = {
  id: "user-1",
  email: "ada@devhubone.local",
  profile: {
    fullName: "Ada Lovelace",
    qualificationBg: "Програмист",
    qualificationEn: "Programmer",
    profileImagePath: null,
  },
};

describe("PublicCalendarService.getCalendar", () => {
  it("marks a day open only when it has at least one visible confirmed attendee", async () => {
    const service = makeService({
      officeDays: [{ date: "2026-07-20", isOpen: true, startTime: "12:00", endTime: "20:00", source: "DEFAULT" }],
      memberDays: [
        {
          userId: "user-1",
          date: "2026-07-20",
          status: "ATTENDING",
          publicSlots: [{ startTime: "12:00", endTime: "20:00" }],
        },
      ],
      users: [activeUser],
    });

    const result = await service.getCalendar("2026-07-20", "2026-07-20");

    expect(result.days[0]).toMatchObject({ isPublicOpenDay: true });
    expect(result.days[0]?.confirmedAttendees).toEqual([
      {
        fullName: "Ada Lovelace",
        profileImagePath: null,
        qualificationBg: "Програмист",
        qualificationEn: "Programmer",
        contactEmail: "ada@devhubone.local",
        slots: [{ startTime: "12:00", endTime: "20:00" }],
      },
    ]);
    expect(result.days[0]?.uncertainAttendees).toEqual([]);
  });

  it("includes multiple slots for one member on one date", async () => {
    const service = makeService({
      officeDays: [{ date: "2026-07-20", isOpen: true, startTime: "10:00", endTime: "20:00", source: "DEFAULT" }],
      memberDays: [
        {
          userId: "user-1",
          date: "2026-07-20",
          status: "ATTENDING",
          publicSlots: [
            { startTime: "10:00", endTime: "12:00" },
            { startTime: "14:00", endTime: "18:00" },
          ],
        },
      ],
      users: [activeUser],
    });

    const result = await service.getCalendar("2026-07-20", "2026-07-20");

    expect(result.days[0]?.confirmedAttendees[0]?.slots).toEqual([
      { startTime: "10:00", endTime: "12:00" },
      { startTime: "14:00", endTime: "18:00" },
    ]);
  });

  it("does not mark a day open when only NOT_SURE members are confirmed", async () => {
    const service = makeService({
      officeDays: [{ date: "2026-07-21", isOpen: true, startTime: "12:00", endTime: "20:00", source: "DEFAULT" }],
      memberDays: [
        {
          userId: "user-1",
          date: "2026-07-21",
          status: "NOT_SURE",
          publicSlots: [{ startTime: "12:00", endTime: "20:00" }],
        },
      ],
      users: [activeUser],
    });

    const result = await service.getCalendar("2026-07-21", "2026-07-21");

    expect(result.days[0]).toMatchObject({ isPublicOpenDay: false });
    expect(result.days[0]?.uncertainAttendees).toHaveLength(1);
    expect(result.days[0]?.confirmedAttendees).toEqual([]);
  });

  it("excludes an ATTENDING member whose clamped slots have zero overlap with office hours", async () => {
    const service = makeService({
      officeDays: [{ date: "2026-07-22", isOpen: true, startTime: "12:00", endTime: "20:00", source: "DEFAULT" }],
      memberDays: [{ userId: "user-1", date: "2026-07-22", status: "ATTENDING", publicSlots: [] }],
      users: [activeUser],
    });

    const result = await service.getCalendar("2026-07-22", "2026-07-22");

    expect(result.days[0]).toMatchObject({ isPublicOpenDay: false });
    expect(result.days[0]?.confirmedAttendees).toEqual([]);
  });

  it("does not mark a closed office day open even with a confirmed attendee", async () => {
    const service = makeService({
      officeDays: [{ date: "2026-07-23", isOpen: false, startTime: null, endTime: null, source: "EXCEPTION" }],
      memberDays: [],
      users: [activeUser],
    });

    const result = await service.getCalendar("2026-07-23", "2026-07-23");

    expect(result.days[0]).toMatchObject({ isPublicOpenDay: false, office: { isOpen: false, isChanged: true } });
  });

  it("never includes an internal member ID field in the public output", async () => {
    const service = makeService({
      officeDays: [{ date: "2026-07-20", isOpen: true, startTime: "12:00", endTime: "20:00", source: "DEFAULT" }],
      memberDays: [
        {
          userId: "user-1",
          date: "2026-07-20",
          status: "ATTENDING",
          publicSlots: [{ startTime: "12:00", endTime: "20:00" }],
        },
      ],
      users: [activeUser],
    });

    const result = await service.getCalendar("2026-07-20", "2026-07-20");

    expect(result.days[0]?.confirmedAttendees[0]).not.toHaveProperty("id");
    expect(result.days[0]?.confirmedAttendees[0]).not.toHaveProperty("userId");
  });

  it("always includes events regardless of office/attendance state", async () => {
    const occurrence = { seriesId: "series-1", occurrenceDate: "2026-07-23" };
    const service = makeService({
      officeDays: [{ date: "2026-07-23", isOpen: false, startTime: null, endTime: null, source: "DEFAULT" }],
      occurrences: [occurrence],
      users: [],
    });

    const result = await service.getCalendar("2026-07-23", "2026-07-23");

    expect(result.events).toEqual([occurrence]);
  });
});
