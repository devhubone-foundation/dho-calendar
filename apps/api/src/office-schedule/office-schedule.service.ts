import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ApiEnv } from "@dho/config";
import {
  type OfficeEffectiveDay,
  type OfficeScheduleDefault,
  type OfficeScheduleDefaultsResponse,
  type OfficeScheduleException,
  type OfficeScheduleExceptionInput,
  type OfficeScheduleExceptionListResponse,
  type UpdateOfficeDefaultsRequest,
  type Weekday,
  WEEKDAYS_IN_ORDER,
} from "@dho/contracts";

import { AuditService } from "../audit/audit.service";
import {
  addMonths,
  clampToHorizon,
  fromDateOnly,
  todayInTimezone,
  toDateOnly,
} from "../common/calendar-date.util";
import { DomainEventsService } from "../common/domain-events/domain-events.service";
import { APP_ENV } from "../config/config.tokens";
import { PrismaService } from "../prisma/prisma.service";
import {
  type OfficeDefaultVersion,
  type OfficeExceptionRow,
  resolveOfficeDay,
  resolveOfficeDefaultForWeekday,
  resolveOfficeRange,
} from "./office-schedule.resolver";

@Injectable()
export class OfficeScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {}

  async getDefaults(): Promise<OfficeScheduleDefaultsResponse> {
    const today = todayInTimezone(this.env.OFFICE_TIMEZONE);
    const versions = await this.getDefaultVersions();
    const days: OfficeScheduleDefault[] = WEEKDAYS_IN_ORDER.map((weekday) => ({
      weekday,
      ...resolveOfficeDefaultForWeekday(versions, weekday, today),
    }));
    return { days };
  }

  /** Only weekdays whose resolved value actually differs get a new version
   * row (and an audit entry / domain event) — resubmitting the whole week
   * from the UI does not create noise for unchanged days. */
  async updateDefaults(
    actorId: string,
    input: UpdateOfficeDefaultsRequest,
  ): Promise<OfficeScheduleDefaultsResponse> {
    const today = todayInTimezone(this.env.OFFICE_TIMEZONE);
    const versions = await this.getDefaultVersions();

    const changes = input.days.filter((day) => {
      const current = resolveOfficeDefaultForWeekday(versions, day.weekday, today);
      return (
        current.isOpen !== day.isOpen ||
        current.startTime !== day.startTime ||
        current.endTime !== day.endTime
      );
    });

    if (changes.length > 0) {
      await this.prisma.officeScheduleDefault.createMany({
        data: changes.map((change) => ({
          weekday: change.weekday,
          isOpen: change.isOpen,
          startTime: change.startTime,
          endTime: change.endTime,
          effectiveFrom: toDateOnly(today),
        })),
      });

      await this.audit.record({
        actorId,
        action: "office-schedule.defaults.updated",
        targetType: "OfficeScheduleDefault",
        metadata: { effectiveFrom: today, changes },
      });

      this.domainEvents.emit("office-schedule.changed", { from: today, to: addMonths(today, 3) });
    }

    return this.getDefaults();
  }

  async listExceptions(from: string, to: string): Promise<OfficeScheduleExceptionListResponse> {
    const rows = await this.prisma.officeScheduleException.findMany({
      where: { date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      orderBy: { date: "asc" },
    });
    return { exceptions: rows.map(toExceptionDto) };
  }

  async upsertException(
    actorId: string,
    date: string,
    input: OfficeScheduleExceptionInput,
  ): Promise<OfficeScheduleException> {
    const existing = await this.prisma.officeScheduleException.findUnique({
      where: { date: toDateOnly(date) },
    });

    const row = await this.prisma.officeScheduleException.upsert({
      where: { date: toDateOnly(date) },
      create: {
        date: toDateOnly(date),
        isOpen: input.isOpen,
        startTime: input.startTime,
        endTime: input.endTime,
      },
      update: { isOpen: input.isOpen, startTime: input.startTime, endTime: input.endTime },
    });

    await this.audit.record({
      actorId,
      action: existing ? "office-schedule.exception.updated" : "office-schedule.exception.created",
      targetType: "OfficeScheduleException",
      targetId: row.id,
      metadata: { date, isOpen: input.isOpen, startTime: input.startTime, endTime: input.endTime },
    });

    this.domainEvents.emit("office-schedule.changed", { from: date, to: date });

    return toExceptionDto(row);
  }

  async deleteException(actorId: string, date: string): Promise<void> {
    const existing = await this.prisma.officeScheduleException.findUnique({
      where: { date: toDateOnly(date) },
    });
    if (!existing) {
      throw new NotFoundException("No office schedule exception exists for that date");
    }

    await this.prisma.officeScheduleException.delete({ where: { date: toDateOnly(date) } });

    await this.audit.record({
      actorId,
      action: "office-schedule.exception.deleted",
      targetType: "OfficeScheduleException",
      targetId: existing.id,
      metadata: { date },
    });

    this.domainEvents.emit("office-schedule.changed", { from: date, to: date });
  }

  async resolveRange(from: string, to: string): Promise<OfficeEffectiveDay[]> {
    const today = todayInTimezone(this.env.OFFICE_TIMEZONE);
    const clampedTo = clampToHorizon(to, today);
    const [versions, exceptions] = await this.loadDefaultsAndExceptions(from, clampedTo);
    return resolveOfficeRange(versions, exceptions, from, clampedTo);
  }

  /** Resolves a single date's effective office state, uncapped by the 3-month
   * range horizon. Used internally by the attendance module (clamping,
   * coverage checks) and by the range resolver above. */
  async resolveEffectiveDay(date: string): Promise<OfficeEffectiveDay> {
    const [versions, exceptions] = await this.loadDefaultsAndExceptions(date, date);
    return resolveOfficeDay(versions, exceptions, date);
  }

  private async loadDefaultsAndExceptions(
    from: string,
    to: string,
  ): Promise<[OfficeDefaultVersion[], OfficeExceptionRow[]]> {
    const [versions, exceptionRows] = await Promise.all([
      this.getDefaultVersions(),
      this.prisma.officeScheduleException.findMany({
        where: { date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      }),
    ]);
    const exceptions: OfficeExceptionRow[] = exceptionRows.map((row) => ({
      date: fromDateOnly(row.date),
      isOpen: row.isOpen,
      startTime: row.startTime,
      endTime: row.endTime,
    }));
    return [versions, exceptions];
  }

  async getDefaultVersions(): Promise<OfficeDefaultVersion[]> {
    const rows = await this.prisma.officeScheduleDefault.findMany();
    return rows.map((row) => ({
      weekday: row.weekday as Weekday,
      isOpen: row.isOpen,
      startTime: row.startTime,
      endTime: row.endTime,
      effectiveFrom: fromDateOnly(row.effectiveFrom),
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

function toExceptionDto(row: {
  date: Date;
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OfficeScheduleException {
  return {
    date: fromDateOnly(row.date),
    isOpen: row.isOpen,
    startTime: row.startTime,
    endTime: row.endTime,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
