import { describe, expect, it } from "vitest";

import { auditLogEntrySchema, auditLogListResponseSchema } from "./audit";

describe("auditLogEntrySchema", () => {
  it("accepts a well-formed entry with structured metadata", () => {
    expect(() =>
      auditLogEntrySchema.parse({
        id: "log-1",
        actorId: "user-1",
        actorEmail: "admin@devhubone.local",
        action: "event.created",
        targetType: "EventSeries",
        targetId: "series-1",
        metadata: { titleEn: "Workshop" },
        createdAt: "2026-07-20T12:00:00.000Z",
      }),
    ).not.toThrow();
  });

  it("accepts null actorId, actorEmail, targetId, and metadata", () => {
    expect(() =>
      auditLogEntrySchema.parse({
        id: "log-1",
        actorId: null,
        actorEmail: null,
        action: "member.deactivated",
        targetType: "User",
        targetId: null,
        metadata: null,
        createdAt: "2026-07-20T12:00:00.000Z",
      }),
    ).not.toThrow();
  });
});

describe("auditLogListResponseSchema", () => {
  it("accepts an empty entry list", () => {
    expect(() => auditLogListResponseSchema.parse({ entries: [] })).not.toThrow();
  });
});
