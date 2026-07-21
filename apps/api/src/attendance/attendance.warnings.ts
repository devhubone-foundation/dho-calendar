import type { AttendanceStatus, AttendanceWarning } from "@dho/contracts";

export interface WarningDayInput {
  /** "YYYY-MM-DD" */
  date: string;
  officeIsOpen: boolean;
  officeStartTime: string | null;
  officeEndTime: string | null;
  /** Resolved status for every active member on this date. */
  memberStatuses: AttendanceStatus[];
}

/**
 * PRODUCT_BLUEPRINT.md §19.1: warn when a working day has no active member
 * confirmed `ATTENDING`. `NOT_SURE` never counts as confirmed coverage, and a
 * closed office day never warns (nothing to cover). The reason distinguishes
 * "nobody signaled anything" from "someone is uncertain, but nobody confirmed"
 * so the admin dashboard can explain why a date is flagged.
 */
export function evaluateDayWarning(day: WarningDayInput): AttendanceWarning | null {
  if (!day.officeIsOpen) {
    return null;
  }
  if (day.memberStatuses.some((status) => status === "ATTENDING")) {
    return null;
  }

  const reason = day.memberStatuses.some((status) => status === "NOT_SURE")
    ? "ONLY_UNCERTAIN_OR_ABSENT"
    : "NO_RECORDS";

  return {
    date: day.date,
    reason,
    officeStartTime: day.officeStartTime,
    officeEndTime: day.officeEndTime,
  };
}

export function evaluateWarnings(days: WarningDayInput[]): AttendanceWarning[] {
  const warnings: AttendanceWarning[] = [];
  for (const day of days) {
    const warning = evaluateDayWarning(day);
    if (warning) {
      warnings.push(warning);
    }
  }
  return warnings;
}
