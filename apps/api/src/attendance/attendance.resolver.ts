import type { AttendanceSlot, AttendanceStatus, OfficeEffectiveDay, Weekday } from "@dho/contracts";

import {
  type OfficeDefaultVersion,
  resolveOfficeDefaultForWeekday,
} from "../office-schedule/office-schedule.resolver";
import { weekdayOf } from "../common/calendar-date.util";

export interface MemberWeeklyVersion {
  weekday: Weekday;
  attends: boolean;
  slots: AttendanceSlot[];
  /** "YYYY-MM-DD" — the date this version starts applying from. */
  effectiveFrom: string;
  /** ISO timestamp, used only to break ties between same-day versions. */
  createdAt: string;
}

export interface AttendanceExceptionRow {
  /** "YYYY-MM-DD" */
  date: string;
  status: AttendanceStatus;
  slots: AttendanceSlot[];
}

export interface ResolvedWeeklyDay {
  attends: boolean;
  slots: AttendanceSlot[];
}

export interface MemberDayResult {
  status: AttendanceStatus;
  enteredSlots: AttendanceSlot[];
  /** True when this date has its own date-specific change rather than
   * falling back to the personal weekly default. */
  isCustomized: boolean;
}

export interface MemberEffectiveAttendanceResult {
  status: AttendanceStatus;
  isCustomized: boolean;
  enteredSlots: AttendanceSlot[];
  officeIsOpen: boolean;
  publicSlots: AttendanceSlot[];
  isClamped: boolean;
}

/** Picks the personal weekly-schedule version in force on `asOfDate` for one
 * weekday, the same future-only versioning rule as office defaults. Returns
 * `null` when the member has never explicitly saved that weekday — the
 * caller then falls back to the inherited office default. */
export function resolveMemberWeeklyForWeekday(
  versions: MemberWeeklyVersion[],
  weekday: Weekday,
  asOfDate: string,
): ResolvedWeeklyDay | null {
  const candidates = versions.filter((v) => v.weekday === weekday && v.effectiveFrom <= asOfDate);
  if (candidates.length === 0) {
    return null;
  }
  const latest = candidates.reduce((best, current) => {
    if (current.effectiveFrom !== best.effectiveFrom) {
      return current.effectiveFrom > best.effectiveFrom ? current : best;
    }
    return current.createdAt > best.createdAt ? current : best;
  });
  return { attends: latest.attends, slots: latest.slots };
}

/**
 * Full precedence chain for one member/date, ARCHITECTURE.md §11 layers 3-4
 * plus the inheritance fallback: date exception > personal weekly > office
 * default as of the member's account-creation date (frozen there — the
 * personal schedule is independent from later office-default changes once
 * inherited, PRODUCT_BLUEPRINT.md §12.4).
 */
export function resolveMemberDay(
  weeklyVersions: MemberWeeklyVersion[],
  exceptions: AttendanceExceptionRow[],
  officeDefaultVersions: OfficeDefaultVersion[],
  memberCreatedAt: string,
  date: string,
): MemberDayResult {
  const exception = exceptions.find((e) => e.date === date);
  if (exception) {
    return { status: exception.status, enteredSlots: exception.slots, isCustomized: true };
  }

  const weekday = weekdayOf(date);
  const explicitWeekly = resolveMemberWeeklyForWeekday(weeklyVersions, weekday, date);
  if (explicitWeekly) {
    return explicitWeekly.attends
      ? { status: "ATTENDING", enteredSlots: explicitWeekly.slots, isCustomized: false }
      : { status: "NOT_ATTENDING", enteredSlots: [], isCustomized: false };
  }

  const inherited = resolveOfficeDefaultForWeekday(officeDefaultVersions, weekday, memberCreatedAt);
  if (!inherited.isOpen) {
    return { status: "NOT_ATTENDING", enteredSlots: [], isCustomized: false };
  }
  const inheritedSlots: AttendanceSlot[] =
    inherited.startTime && inherited.endTime
      ? [{ startTime: inherited.startTime, endTime: inherited.endTime }]
      : [];
  return { status: "ATTENDING", enteredSlots: inheritedSlots, isCustomized: false };
}

/**
 * Intersects each entered slot with effective office hours. Out-of-hours
 * attendance is never mutated — `enteredSlots` always carries exactly what
 * was saved; `publicSlots` is the clamped view, with slots that have zero
 * overlap dropped entirely. `isClamped` is true whenever the public slot
 * list differs from what was entered in any way (a changed time or a
 * dropped slot).
 *
 * PRODUCT_BLUEPRINT.md §12.8/§13: confirmed (`ATTENDING`) attendance on a
 * date the base schedule marks closed overrides that closure — there is no
 * office-hours bound to clamp against, so the entered slots pass through
 * unclamped as `publicSlots`. `NOT_SURE`/`NOT_ATTENDING` never open a closed
 * date, so they keep the empty-slots behavior.
 */
export function clampToOfficeHours(
  memberDay: MemberDayResult,
  office: Pick<OfficeEffectiveDay, "isOpen" | "startTime" | "endTime">,
): MemberEffectiveAttendanceResult {
  const base = {
    status: memberDay.status,
    isCustomized: memberDay.isCustomized,
    enteredSlots: memberDay.enteredSlots,
    officeIsOpen: office.isOpen,
  };

  if (memberDay.status === "ATTENDING" && !office.isOpen) {
    return { ...base, publicSlots: memberDay.enteredSlots, isClamped: false };
  }

  const canHaveInterval =
    memberDay.status !== "NOT_ATTENDING" && office.isOpen && office.startTime !== null && office.endTime !== null;

  if (!canHaveInterval) {
    return { ...base, publicSlots: [], isClamped: false };
  }

  const officeStart = office.startTime as string;
  const officeEnd = office.endTime as string;

  const publicSlots: AttendanceSlot[] = [];
  let isClamped = false;
  for (const slot of memberDay.enteredSlots) {
    const clampedStart = slot.startTime > officeStart ? slot.startTime : officeStart;
    const clampedEnd = slot.endTime < officeEnd ? slot.endTime : officeEnd;
    if (clampedStart >= clampedEnd) {
      // No overlap with office hours at all — drop the slot from public view.
      isClamped = true;
      continue;
    }
    if (clampedStart !== slot.startTime || clampedEnd !== slot.endTime) {
      isClamped = true;
    }
    publicSlots.push({ startTime: clampedStart, endTime: clampedEnd });
  }

  return { ...base, publicSlots, isClamped };
}
