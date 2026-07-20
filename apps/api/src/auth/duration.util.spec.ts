import { msFromDuration } from "./duration.util";

describe("msFromDuration", () => {
  it("parses minutes", () => {
    expect(msFromDuration("15m")).toBe(15 * 60_000);
  });

  it("parses days", () => {
    expect(msFromDuration("30d")).toBe(30 * 86_400_000);
  });

  it("parses hours, seconds, and milliseconds", () => {
    expect(msFromDuration("2h")).toBe(2 * 3_600_000);
    expect(msFromDuration("45s")).toBe(45_000);
    expect(msFromDuration("500ms")).toBe(500);
  });

  it("throws on a malformed duration", () => {
    expect(() => msFromDuration("fifteen minutes")).toThrow();
    expect(() => msFromDuration("15")).toThrow();
    expect(() => msFromDuration("")).toThrow();
  });
});
