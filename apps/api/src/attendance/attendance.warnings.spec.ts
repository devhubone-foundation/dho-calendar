import { evaluateDayWarning, evaluateWarnings, type WarningDayInput } from "./attendance.warnings";

const OPEN_DAY: Omit<WarningDayInput, "memberStatuses"> = {
  date: "2026-07-22",
  officeIsOpen: true,
  officeStartTime: "12:00",
  officeEndTime: "20:00",
};

describe("evaluateDayWarning", () => {
  it("does not warn a closed day regardless of attendance", () => {
    const result = evaluateDayWarning({
      ...OPEN_DAY,
      officeIsOpen: false,
      officeStartTime: null,
      officeEndTime: null,
      memberStatuses: [],
    });
    expect(result).toBeNull();
  });

  it("does not warn when at least one member is ATTENDING", () => {
    const result = evaluateDayWarning({
      ...OPEN_DAY,
      memberStatuses: ["NOT_SURE", "ATTENDING", "NOT_ATTENDING"],
    });
    expect(result).toBeNull();
  });

  it("warns with NO_RECORDS when nobody has any positive signal", () => {
    const result = evaluateDayWarning({ ...OPEN_DAY, memberStatuses: ["NOT_ATTENDING", "NOT_ATTENDING"] });
    expect(result).toMatchObject({ date: "2026-07-22", reason: "NO_RECORDS" });
  });

  it("warns with NO_RECORDS when there are no active members at all", () => {
    const result = evaluateDayWarning({ ...OPEN_DAY, memberStatuses: [] });
    expect(result).toMatchObject({ reason: "NO_RECORDS" });
  });

  it("still warns, with ONLY_UNCERTAIN_OR_ABSENT, when someone is only Not sure", () => {
    const result = evaluateDayWarning({ ...OPEN_DAY, memberStatuses: ["NOT_SURE", "NOT_ATTENDING"] });
    expect(result).toMatchObject({ date: "2026-07-22", reason: "ONLY_UNCERTAIN_OR_ABSENT" });
  });
});

describe("evaluateWarnings", () => {
  it("only returns entries for days that actually warn", () => {
    const result = evaluateWarnings([
      { ...OPEN_DAY, date: "2026-07-20", memberStatuses: ["ATTENDING"] },
      { ...OPEN_DAY, date: "2026-07-22", memberStatuses: ["NOT_SURE"] },
      { ...OPEN_DAY, date: "2026-07-24", officeIsOpen: false, officeStartTime: null, officeEndTime: null, memberStatuses: [] },
    ]);
    expect(result.map((w) => w.date)).toEqual(["2026-07-22"]);
  });
});
