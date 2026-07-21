import { describe, expect, it } from "vitest";

import { formValueToIso, isoToFormValue } from "./event-form";

describe("formValueToIso / isoToFormValue (timed events)", () => {
  it("maps a datetime-local value directly onto a UTC instant", () => {
    expect(formValueToIso("2026-08-03T09:00", false, false)).toBe("2026-08-03T09:00:00.000Z");
  });

  it("round-trips back to the same form value", () => {
    const iso = formValueToIso("2026-08-03T14:30", false, false);
    expect(isoToFormValue(iso, false, false)).toBe("2026-08-03T14:30");
  });
});

describe("formValueToIso / isoToFormValue (all-day events)", () => {
  it("maps the start date directly to midnight", () => {
    expect(formValueToIso("2026-08-03", true, false)).toBe("2026-08-03T00:00:00.000Z");
  });

  it("stores an inclusive end-date input as the exclusive following midnight", () => {
    expect(formValueToIso("2026-08-03", true, true)).toBe("2026-08-04T00:00:00.000Z");
  });

  it("displays the exclusive stored end instant as the inclusive end date", () => {
    expect(isoToFormValue("2026-08-04T00:00:00.000Z", true, true)).toBe("2026-08-03");
  });

  it("round-trips a multi-day span", () => {
    const startIso = formValueToIso("2026-08-03", true, false);
    const endIso = formValueToIso("2026-08-05", true, true);
    expect(isoToFormValue(startIso, true, false)).toBe("2026-08-03");
    expect(isoToFormValue(endIso, true, true)).toBe("2026-08-05");
  });
});
