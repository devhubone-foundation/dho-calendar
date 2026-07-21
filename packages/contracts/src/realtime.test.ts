import { describe, expect, it } from "vitest";

import { isResizeMessage, RESIZE_MESSAGE_SOURCE, resizeMessageSchema, socketEventNameSchema } from "./realtime";

describe("resizeMessageSchema / isResizeMessage", () => {
  it("accepts a well-formed resize message", () => {
    const message = { source: RESIZE_MESSAGE_SOURCE, type: "resize", height: 640 };
    expect(() => resizeMessageSchema.parse(message)).not.toThrow();
    expect(isResizeMessage(message)).toBe(true);
  });

  it("rejects a message with the wrong source", () => {
    expect(isResizeMessage({ source: "some-other-widget", type: "resize", height: 640 })).toBe(false);
  });

  it("rejects a message with the wrong type", () => {
    expect(isResizeMessage({ source: RESIZE_MESSAGE_SOURCE, type: "scroll", height: 640 })).toBe(false);
  });

  it("rejects a non-positive height", () => {
    expect(isResizeMessage({ source: RESIZE_MESSAGE_SOURCE, type: "resize", height: 0 })).toBe(false);
    expect(isResizeMessage({ source: RESIZE_MESSAGE_SOURCE, type: "resize", height: -10 })).toBe(false);
  });

  it("rejects arbitrary unrelated payloads without throwing", () => {
    expect(isResizeMessage("not an object")).toBe(false);
    expect(isResizeMessage(null)).toBe(false);
    expect(isResizeMessage(undefined)).toBe(false);
  });
});

describe("socketEventNameSchema", () => {
  it("accepts every documented ARCHITECTURE.md §9 event name", () => {
    for (const name of [
      "office-schedule.changed",
      "attendance.changed",
      "event.changed",
      "profile.changed",
      "member-status.changed",
    ]) {
      expect(() => socketEventNameSchema.parse(name)).not.toThrow();
    }
  });

  it("rejects an unknown event name", () => {
    expect(() => socketEventNameSchema.parse("something.else")).toThrow();
  });
});
