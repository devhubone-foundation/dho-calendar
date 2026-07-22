import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ApiEnv } from "@dho/config";
import {
  type AttendanceException,
  type AttendanceExceptionInput,
  type AttendanceExceptionListResponse,
  type AttendanceSlot,
  type AttendanceStatus,
  type AttendanceWarning,
  type AttendanceWarningListResponse,
  type MemberEffectiveAttendance,
  type MemberWeeklyScheduleDay,
  type MemberWeeklyScheduleResponse,
  type UpdateWeeklyScheduleRequest,
  type Weekday,
  WEEKDAYS_IN_ORDER,
} from "@dho/contracts";

import { AuditService } from "../audit/audit.service";
import {
  addDays,
  addMonths,
  clampToHorizon,
  dateInTimezone,
  enumerateDates,
  fromDateOnly,
  todayInTimezone,
  toDateOnly,
} from "../common/calendar-date.util";
import { DomainEventsService } from "../common/domain-events/domain-events.service";
import { APP_ENV } from "../config/config.tokens";
import { resolveOfficeDefaultForWeekday } from "../office-schedule/office-schedule.resolver";
import { OfficeScheduleService } from "../office-schedule/office-schedule.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  type AttendanceExceptionRow,
  type MemberWeeklyVersion,
  clampToOfficeHours,
  resolveMemberDay,
  resolveMemberWeeklyForWeekday,
} from "./attendance.resolver";
import { evaluateDayWarning } from "./attendance.warnings";

const SLOT_ORDER = { orderBy: { sortOrder: "asc" as const } };

/** One active member's clamped attendance on one date — the public-calendar
 * composition unit (see `resolveActiveMembersForRange`). */
export interface ActiveMemberAttendanceDay {
  userId: string;
  /** "YYYY-MM-DD" */
  date: string;
  status: AttendanceStatus;
  publicSlots: AttendanceSlot[];
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    private readonly officeSchedule: OfficeScheduleService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {}

  async getWeeklySchedule(userId: string): Promise<MemberWeeklyScheduleResponse> {
    const user = await this.getUserOrThrow(userId);
    const [weeklyVersions, officeDefaultVersions] = await Promise.all([
      this.loadWeeklyVersions(userId),
      this.officeSchedule.getDefaultVersions(),
    ]);
    const today = todayInTimezone(this.env.OFFICE_TIMEZONE);
    const memberCreatedAt = dateInTimezone(user.createdAt, this.env.OFFICE_TIMEZONE);

    const days: MemberWeeklyScheduleDay[] = WEEKDAYS_IN_ORDER.map((weekday) => {
      const explicit = resolveMemberWeeklyForWeekday(weeklyVersions, weekday, today);
      if (explicit) {
        return { weekday, ...explicit, isInherited: false };
      }
      const inherited = resolveOfficeDefaultForWeekday(officeDefaultVersions, weekday, memberCreatedAt);
      const inheritedSlots: AttendanceSlot[] =
        inherited.isOpen && inherited.startTime && inherited.endTime
          ? [{ startTime: inherited.startTime, endTime: inherited.endTime }]
          : [];
      return {
        weekday,
        attends: inherited.isOpen,
        slots: inheritedSlots,
        isInherited: true,
      };
    });

    return { days };
  }

  /** Only weekdays whose resolved value actually differs get a new version
   * row — a member who never touches Monday/Friday keeps inheriting whatever
   * the office default for those days is, even after customizing Wednesday. */
  async updateWeeklySchedule(
    actorId: string,
    userId: string,
    input: UpdateWeeklyScheduleRequest,
  ): Promise<MemberWeeklyScheduleResponse> {
    await this.getUserOrThrow(userId);
    const current = await this.getWeeklySchedule(userId);
    const today = todayInTimezone(this.env.OFFICE_TIMEZONE);

    const changes = input.days.filter((day) => {
      const currentDay = current.days.find((d) => d.weekday === day.weekday);
      return (
        !currentDay ||
        currentDay.attends !== day.attends ||
        JSON.stringify(currentDay.slots) !== JSON.stringify(day.slots)
      );
    });

    if (changes.length > 0) {
      await this.prisma.$transaction(
        changes.map((change) =>
          this.prisma.memberWeeklySchedule.create({
            data: {
              userId,
              weekday: change.weekday,
              attends: change.attends,
              effectiveFrom: toDateOnly(today),
              slots: {
                create: change.slots.map((slot, index) => ({
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  sortOrder: index,
                })),
              },
            },
          }),
        ),
      );

      await this.audit.record({
        actorId,
        action: "attendance.weekly.updated",
        targetType: "MemberWeeklySchedule",
        targetId: userId,
        metadata: { userId, effectiveFrom: today, changes },
      });

      this.domainEvents.emit("attendance.changed", { userId, from: today, to: addMonths(today, 3) });
    }

    return this.getWeeklySchedule(userId);
  }

  async listExceptions(userId: string, from: string, to: string): Promise<AttendanceExceptionListResponse> {
    await this.getUserOrThrow(userId);
    const rows = await this.prisma.attendanceException.findMany({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      include: { slots: SLOT_ORDER },
      orderBy: { date: "asc" },
    });
    return { exceptions: rows.map(toAttendanceExceptionDto) };
  }

  async upsertException(
    actorId: string,
    userId: string,
    date: string,
    input: AttendanceExceptionInput,
  ): Promise<AttendanceException> {
    await this.getUserOrThrow(userId);
    const existing = await this.prisma.attendanceException.findUnique({
      where: { userId_date: { userId, date: toDateOnly(date) } },
    });

    const slotsData = input.slots.map((slot, index) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      sortOrder: index,
    }));

    const row = await this.prisma.attendanceException.upsert({
      where: { userId_date: { userId, date: toDateOnly(date) } },
      create: {
        userId,
        date: toDateOnly(date),
        status: input.status,
        slots: { create: slotsData },
      },
      update: {
        status: input.status,
        slots: { deleteMany: {}, create: slotsData },
      },
      include: { slots: SLOT_ORDER },
    });

    await this.audit.record({
      actorId,
      action: existing ? "attendance.exception.updated" : "attendance.exception.created",
      targetType: "AttendanceException",
      targetId: row.id,
      metadata: { userId, date, status: input.status, slots: input.slots },
    });

    this.domainEvents.emit("attendance.changed", { userId, from: date, to: date });

    return toAttendanceExceptionDto(row);
  }

  /** Removes a member's date-specific customization so the date falls back to
   * the personal weekly default again — this is what the daily editor's "use
   * my default schedule" action calls. */
  async deleteException(actorId: string, userId: string, date: string): Promise<void> {
    await this.getUserOrThrow(userId);
    const existing = await this.prisma.attendanceException.findUnique({
      where: { userId_date: { userId, date: toDateOnly(date) } },
    });
    if (!existing) {
      throw new NotFoundException("No attendance exception exists for that date");
    }

    await this.prisma.attendanceException.delete({ where: { userId_date: { userId, date: toDateOnly(date) } } });

    await this.audit.record({
      actorId,
      action: "attendance.exception.deleted",
      targetType: "AttendanceException",
      targetId: existing.id,
      metadata: { userId, date },
    });

    this.domainEvents.emit("attendance.changed", { userId, from: date, to: date });
  }

  async resolveRange(userId: string, from: string, to: string): Promise<MemberEffectiveAttendance[]> {
    const user = await this.getUserOrThrow(userId);
    const today = todayInTimezone(this.env.OFFICE_TIMEZONE);
    const clampedTo = clampToHorizon(to, today);

    const [weeklyVersions, exceptions, officeDefaultVersions, officeDays] = await Promise.all([
      this.loadWeeklyVersions(userId),
      this.loadExceptionRows(userId, from, clampedTo),
      this.officeSchedule.getDefaultVersions(),
      this.officeSchedule.resolveRange(from, clampedTo),
    ]);

    const memberCreatedAt = dateInTimezone(user.createdAt, this.env.OFFICE_TIMEZONE);
    const officeByDate = new Map(officeDays.map((day) => [day.date, day]));

    return enumerateDates(from, clampedTo).map((date) => {
      const memberDay = resolveMemberDay(weeklyVersions, exceptions, officeDefaultVersions, memberCreatedAt, date);
      const officeDay = officeByDate.get(date);
      return { date, ...clampToOfficeHours(memberDay, officeDay ?? { isOpen: false, startTime: null, endTime: null }) };
    });
  }

  /** Single-date resolution, uncapped by the 3-month range horizon (mirrors
   * OfficeScheduleService.resolveEffectiveDay). Used by the warning scan. */
  async resolveEffectiveDay(userId: string, date: string): Promise<MemberEffectiveAttendance> {
    const user = await this.getUserOrThrow(userId);
    const [weeklyVersions, exceptions, officeDefaultVersions, officeDay] = await Promise.all([
      this.loadWeeklyVersions(userId),
      this.loadExceptionRows(userId, date, date),
      this.officeSchedule.getDefaultVersions(),
      this.officeSchedule.resolveEffectiveDay(date),
    ]);
    const memberCreatedAt = dateInTimezone(user.createdAt, this.env.OFFICE_TIMEZONE);
    const memberDay = resolveMemberDay(weeklyVersions, exceptions, officeDefaultVersions, memberCreatedAt, date);
    return { date, ...clampToOfficeHours(memberDay, officeDay) };
  }

  /** PRODUCT_BLUEPRINT.md §19 admin dashboard warning: upcoming effectively-open
   * working days with no active member confirmed ATTENDING. Look-ahead
   * defaults to ATTENDANCE_WARNING_LOOKAHEAD_DAYS (documented, configurable
   * per §19.3), overridable per-call for tests/manual inspection. */
  async computeWarnings(lookaheadDaysOverride?: number): Promise<AttendanceWarningListResponse> {
    const lookaheadDays = lookaheadDaysOverride ?? this.env.ATTENDANCE_WARNING_LOOKAHEAD_DAYS;
    const today = todayInTimezone(this.env.OFFICE_TIMEZONE);
    const to = addDays(today, lookaheadDays);

    const [officeDays, activeUsers, officeDefaultVersions] = await Promise.all([
      this.officeSchedule.resolveRange(today, to),
      this.prisma.user.findMany({ where: { isActive: true }, select: { id: true, createdAt: true } }),
      this.officeSchedule.getDefaultVersions(),
    ]);

    const openDays = officeDays.filter((day) => day.isOpen);
    if (openDays.length === 0) {
      return { warnings: [] };
    }

    const userIds = activeUsers.map((user) => user.id);
    const [weeklyRows, exceptionRows] = await Promise.all([
      this.prisma.memberWeeklySchedule.findMany({ where: { userId: { in: userIds } }, include: { slots: SLOT_ORDER } }),
      this.prisma.attendanceException.findMany({
        where: { userId: { in: userIds }, date: { gte: toDateOnly(today), lte: toDateOnly(to) } },
        include: { slots: SLOT_ORDER },
      }),
    ]);

    const weeklyByUser = groupByUserId(weeklyRows);
    const exceptionsByUser = groupByUserId(exceptionRows);

    const warnings: AttendanceWarning[] = [];
    for (const day of openDays) {
      const memberStatuses: AttendanceStatus[] = activeUsers.map((user) => {
        const weeklyVersions = toWeeklyVersions(weeklyByUser.get(user.id) ?? []);
        const exceptions = toExceptionRows(exceptionsByUser.get(user.id) ?? []);
        const memberCreatedAt = dateInTimezone(user.createdAt, this.env.OFFICE_TIMEZONE);
        return resolveMemberDay(weeklyVersions, exceptions, officeDefaultVersions, memberCreatedAt, day.date).status;
      });

      const warning = evaluateDayWarning({
        date: day.date,
        officeIsOpen: day.isOpen,
        officeStartTime: day.startTime,
        officeEndTime: day.endTime,
        memberStatuses,
      });
      if (warning) {
        warnings.push(warning);
      }
    }

    return { warnings };
  }

  /** All active members' resolved attendance for every date in [from, to]
   * (capped to the 3-month horizon), already clamped to office hours. Feeds
   * the public-calendar module's confirmed/uncertain attendee composition
   * (PRODUCT_BLUEPRINT.md §13) — mirrors the per-member resolution loop used
   * by `computeWarnings` but returns full per-date results instead of an
   * aggregated warning. */
  async resolveActiveMembersForRange(from: string, to: string): Promise<ActiveMemberAttendanceDay[]> {
    const today = todayInTimezone(this.env.OFFICE_TIMEZONE);
    const clampedTo = clampToHorizon(to, today);

    const activeUsers = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, createdAt: true },
    });
    if (activeUsers.length === 0) {
      return [];
    }

    const [officeDays, officeDefaultVersions, weeklyRows, exceptionRows] = await Promise.all([
      this.officeSchedule.resolveRange(from, clampedTo),
      this.officeSchedule.getDefaultVersions(),
      this.prisma.memberWeeklySchedule.findMany({
        where: { userId: { in: activeUsers.map((user) => user.id) } },
        include: { slots: SLOT_ORDER },
      }),
      this.prisma.attendanceException.findMany({
        where: {
          userId: { in: activeUsers.map((user) => user.id) },
          date: { gte: toDateOnly(from), lte: toDateOnly(clampedTo) },
        },
        include: { slots: SLOT_ORDER },
      }),
    ]);

    const officeByDate = new Map(officeDays.map((day) => [day.date, day]));
    const weeklyByUser = groupByUserId(weeklyRows);
    const exceptionsByUser = groupByUserId(exceptionRows);
    const dates = enumerateDates(from, clampedTo);

    const results: ActiveMemberAttendanceDay[] = [];
    for (const user of activeUsers) {
      const weeklyVersions = toWeeklyVersions(weeklyByUser.get(user.id) ?? []);
      const exceptions = toExceptionRows(exceptionsByUser.get(user.id) ?? []);
      const memberCreatedAt = dateInTimezone(user.createdAt, this.env.OFFICE_TIMEZONE);

      for (const date of dates) {
        const officeDay = officeByDate.get(date) ?? { isOpen: false, startTime: null, endTime: null };
        const memberDay = resolveMemberDay(weeklyVersions, exceptions, officeDefaultVersions, memberCreatedAt, date);
        const clamped = clampToOfficeHours(memberDay, officeDay);
        results.push({
          userId: user.id,
          date,
          status: clamped.status,
          publicSlots: clamped.publicSlots,
        });
      }
    }

    return results;
  }

  private async getUserOrThrow(userId: string): Promise<{ id: string; createdAt: Date }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true },
    });
    if (!user) {
      throw new NotFoundException("Member not found");
    }
    return user;
  }

  private async loadWeeklyVersions(userId: string): Promise<MemberWeeklyVersion[]> {
    const rows = await this.prisma.memberWeeklySchedule.findMany({
      where: { userId },
      include: { slots: SLOT_ORDER },
    });
    return toWeeklyVersions(rows);
  }

  private async loadExceptionRows(userId: string, from: string, to: string): Promise<AttendanceExceptionRow[]> {
    const rows = await this.prisma.attendanceException.findMany({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      include: { slots: SLOT_ORDER },
    });
    return toExceptionRows(rows);
  }
}

interface SlotRow {
  startTime: string;
  endTime: string;
}

function toAttendanceSlots(slots: SlotRow[]): AttendanceSlot[] {
  return slots.map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime }));
}

function toWeeklyVersions(
  rows: {
    weekday: string;
    attends: boolean;
    slots: SlotRow[];
    effectiveFrom: Date;
    createdAt: Date;
  }[],
): MemberWeeklyVersion[] {
  return rows.map((row) => ({
    weekday: row.weekday as Weekday,
    attends: row.attends,
    slots: toAttendanceSlots(row.slots),
    effectiveFrom: fromDateOnly(row.effectiveFrom),
    createdAt: row.createdAt.toISOString(),
  }));
}

function toExceptionRows(rows: { date: Date; status: string; slots: SlotRow[] }[]): AttendanceExceptionRow[] {
  return rows.map((row) => ({
    date: fromDateOnly(row.date),
    status: row.status as AttendanceStatus,
    slots: toAttendanceSlots(row.slots),
  }));
}

function toAttendanceExceptionDto(row: {
  date: Date;
  status: string;
  slots: SlotRow[];
  createdAt: Date;
  updatedAt: Date;
}): AttendanceException {
  return {
    date: fromDateOnly(row.date),
    status: row.status as AttendanceStatus,
    slots: toAttendanceSlots(row.slots),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function groupByUserId<T extends { userId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.userId);
    if (list) {
      list.push(row);
    } else {
      map.set(row.userId, [row]);
    }
  }
  return map;
}
