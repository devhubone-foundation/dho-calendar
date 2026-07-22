import type { EventOccurrence, PublicCalendarDay } from "@dho/contracts";

/** Pure helpers for positioning the Week view's time-grid (office-open band,
 * attendance intervals, event blocks) — no rendering, no i18n. */

const DEFAULT_START_MINUTES = 9 * 60;
const DEFAULT_END_MINUTES = 21 * 60;
const MIN_SPAN_MINUTES = 8 * 60;
const EDGE_PADDING_MINUTES = 30;

export interface TimeRange {
  startMinutes: number;
  endMinutes: number;
}

/** "HH:MM" (office-local, already timezone-resolved) -> minutes since midnight. */
export function timeOfDayToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number) as [number, number];
  return hours * 60 + minutes;
}

/** ISO instant -> minutes since midnight in the office timezone. */
export function instantToOfficeMinutes(isoInstant: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoInstant));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** The visible time span for a week's grid: wide enough to fit every
 * office-open window, attendance interval, and non-all-day event that week,
 * clamped to a sane minimum span and padded at both edges. Falls back to a
 * default 09:00-21:00 window when there is nothing to show yet. */
export function computeWeekTimeRange(days: PublicCalendarDay[], occurrences: EventOccurrence[]): TimeRange {
  let min = Infinity;
  let max = -Infinity;

  for (const day of days) {
    if (day.office.isOpen && day.office.startTime && day.office.endTime) {
      min = Math.min(min, timeOfDayToMinutes(day.office.startTime));
      max = Math.max(max, timeOfDayToMinutes(day.office.endTime));
    }
    for (const member of [...day.confirmedAttendees, ...day.uncertainAttendees]) {
      for (const slot of member.slots) {
        min = Math.min(min, timeOfDayToMinutes(slot.startTime));
        max = Math.max(max, timeOfDayToMinutes(slot.endTime));
      }
    }
  }
  for (const occurrence of occurrences) {
    if (occurrence.isAllDay) continue;
    min = Math.min(min, instantToOfficeMinutes(occurrence.startAt));
    max = Math.max(max, instantToOfficeMinutes(occurrence.endAt));
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { startMinutes: DEFAULT_START_MINUTES, endMinutes: DEFAULT_END_MINUTES };
  }

  let startMinutes = Math.max(0, min - EDGE_PADDING_MINUTES);
  let endMinutes = Math.min(24 * 60, max + EDGE_PADDING_MINUTES);
  if (endMinutes - startMinutes < MIN_SPAN_MINUTES) {
    const deficit = MIN_SPAN_MINUTES - (endMinutes - startMinutes);
    startMinutes = Math.max(0, startMinutes - deficit / 2);
    endMinutes = Math.min(24 * 60, startMinutes + MIN_SPAN_MINUTES);
  }
  // Snap to whole hours so axis labels land cleanly.
  startMinutes = Math.floor(startMinutes / 60) * 60;
  endMinutes = Math.ceil(endMinutes / 60) * 60;
  return { startMinutes, endMinutes };
}

export const HOUR_HEIGHT_REM = 3.5;

/** Vertical offset (rem, from the column top) for a given minute-of-day. */
export function minutesToOffsetRem(minutes: number, range: TimeRange): number {
  const clamped = Math.min(Math.max(minutes, range.startMinutes), range.endMinutes);
  return ((clamped - range.startMinutes) / 60) * HOUR_HEIGHT_REM;
}

/** Column height (rem) for the whole visible range. */
export function rangeHeightRem(range: TimeRange): number {
  return ((range.endMinutes - range.startMinutes) / 60) * HOUR_HEIGHT_REM;
}

/** Hour marks for the left-hand time axis, e.g. every 2 hours. */
export function hourMarks(range: TimeRange, stepHours = 2): number[] {
  const marks: number[] = [];
  for (
    let minutes = Math.ceil(range.startMinutes / (stepHours * 60)) * stepHours * 60;
    minutes <= range.endMinutes;
    minutes += stepHours * 60
  ) {
    marks.push(minutes);
  }
  return marks;
}

export function formatHourMark(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:00`;
}
