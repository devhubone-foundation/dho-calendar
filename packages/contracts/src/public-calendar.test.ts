import { describe, expect, it } from "vitest";

import { publicCalendarQuerySchema, publicCalendarResponseSchema } from "./public-calendar";

describe("publicCalendarQuerySchema", () => {
  it("accepts a valid range", () => {
    expect(() => publicCalendarQuerySchema.parse({ from: "2026-07-01", to: "2026-07-31" })).not.toThrow();
  });

  it("rejects a range where `to` precedes `from`", () => {
    expect(() => publicCalendarQuerySchema.parse({ from: "2026-07-31", to: "2026-07-01" })).toThrow();
  });
});

describe("publicCalendarResponseSchema", () => {
  it("accepts a fully populated response with no internal identifiers on members", () => {
    const parsed = publicCalendarResponseSchema.parse({
      range: { from: "2026-07-01", to: "2026-07-01" },
      days: [
        {
          date: "2026-07-01",
          office: { isOpen: true, startTime: "12:00", endTime: "20:00", isChanged: false },
          isPublicOpenDay: true,
          confirmedAttendees: [
            {
              fullName: "Ada Lovelace",
              profileImagePath: null,
              qualificationBg: "Програмист",
              qualificationEn: "Programmer",
              contactEmail: "ada@example.com",
              slots: [{ startTime: "12:00", endTime: "20:00" }],
            },
          ],
          uncertainAttendees: [],
        },
      ],
      events: [],
    });

    expect(Object.keys(parsed.days[0]!.confirmedAttendees[0]!)).not.toContain("id");
  });

  it("rejects a member entry missing required public fields", () => {
    expect(() =>
      publicCalendarResponseSchema.parse({
        range: { from: "2026-07-01", to: "2026-07-01" },
        days: [
          {
            date: "2026-07-01",
            office: { isOpen: true, startTime: "12:00", endTime: "20:00", isChanged: false },
            isPublicOpenDay: true,
            confirmedAttendees: [{ fullName: "Ada Lovelace" }],
            uncertainAttendees: [],
          },
        ],
        events: [],
      }),
    ).toThrow();
  });
});
