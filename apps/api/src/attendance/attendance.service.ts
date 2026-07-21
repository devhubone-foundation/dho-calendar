import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ApiEnv } from "@dho/config";
import {
  type AttendanceException,
  type AttendanceExceptionInput,
  type AttendanceExceptionListResponse,
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
      return {
        weekday,
        attends: inherited.isOpen,
        startTime: inherited.startTime,
        endTime: inherited.endTime,
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
        currentDay.startTime !== day.startTime ||
        currentDay.endTime !== day.endTime
      );
    });

    if (changes.length > 0) {
      await this.prisma.memberWeeklySchedule.createMany({
        data: changes.map((change) => ({
          userId,
          weekday: change.weekday,
          attends: change.attends,
          startTime: change.startTime,
          endTime: change.endTime,
          effectiveFrom: toDateOnly(today),
        })),
      });

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

    const row = await this.prisma.attendanceException.upsert({
      where: { userId_date: { userId, date: toDateOnly(date) } },
      create: {
        userId,
        date: toDateOnly(date),
        status: input.status,
        startTime: input.startTime,
        endTime: input.endTime,
      },
      update: { status: input.status, startTime: input.startTime, endTime: input.endTime },
    });

    await this.audit.record({
      actorId,
      action: existing ? "attendance.exception.updated" : "attendance.exception.created",
      targetType: "AttendanceException",
      targetId: row.id,
      metadata: { userId, date, status: input.status, startTime: input.startTime, endTime: input.endTime },
    });

    this.domainEvents.emit("attendance.changed", { userId, from: date, to: date });

    return toAttendanceExceptionDto(row);
  }

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
      this.prisma.memberWeeklySchedule.findMany({ where: { userId: { in: userIds } } }),
      this.prisma.attendanceException.findMany({
        where: { userId: { in: userIds }, date: { gte: toDateOnly(today), lte: toDateOnly(to) } },
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
    const rows = await this.prisma.memberWeeklySchedule.findMany({ where: { userId } });
    return toWeeklyVersions(rows);
  }

  private async loadExceptionRows(userId: string, from: string, to: string): Promise<AttendanceExceptionRow[]> {
    const rows = await this.prisma.attendanceException.findMany({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
    });
    return toExceptionRows(rows);
  }
}

function toWeeklyVersions(
  rows: {
    weekday: string;
    attends: boolean;
    startTime: string | null;
    endTime: string | null;
    effectiveFrom: Date;
    createdAt: Date;
  }[],
): MemberWeeklyVersion[] {
  return rows.map((row) => ({
    weekday: row.weekday as Weekday,
    attends: row.attends,
    startTime: row.startTime,
    endTime: row.endTime,
    effectiveFrom: fromDateOnly(row.effectiveFrom),
    createdAt: row.createdAt.toISOString(),
  }));
}

function toExceptionRows(
  rows: { date: Date; status: string; startTime: string | null; endTime: string | null }[],
): AttendanceExceptionRow[] {
  return rows.map((row) => ({
    date: fromDateOnly(row.date),
    status: row.status as AttendanceStatus,
    startTime: row.startTime,
    endTime: row.endTime,
  }));
}

function toAttendanceExceptionDto(row: {
  date: Date;
  status: string;
  startTime: string | null;
  endTime: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AttendanceException {
  return {
    date: fromDateOnly(row.date),
    status: row.status as AttendanceStatus,
    startTime: row.startTime,
    endTime: row.endTime,
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
