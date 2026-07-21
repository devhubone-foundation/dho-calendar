import { HttpStatus, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ApiEnv } from "@dho/config";
import {
  type CreateEventRequest,
  type DeleteEventOccurrenceRequest,
  type EventCoverUploadResponse,
  type EventOccurrence,
  type EventOccurrenceListResponse,
  type EventSeriesDetail,
  type EventRecurrenceInput,
  type UpdateEventOccurrenceRequest,
  type UpdateEventSeriesFromOccurrenceRequest,
  type UpdateEventSeriesRequest,
  type Weekday,
} from "@dho/contracts";

import { AuditService } from "../audit/audit.service";
import {
  addDays,
  clampToHorizon,
  dateInTimezone,
  fromDateOnly,
  todayInTimezone,
  toDateOnly,
} from "../common/calendar-date.util";
import { AppError } from "../common/errors/app-error";
import { DomainEventsService } from "../common/domain-events/domain-events.service";
import { APP_ENV } from "../config/config.tokens";
import { PrismaService } from "../prisma/prisma.service";
import { EventCoverStorageService } from "../uploads/event-cover-storage.service";
import { type UploadedFileLike, UploadValidationService } from "../uploads/upload-validation.service";
import {
  computeSplitForFutureEdit,
  type EventExceptionForExpansion,
  type EventSeriesForExpansion,
  type EventSeriesPattern,
  type ExpandedOccurrence,
  expandOccurrences,
  isValidOccurrenceDate,
} from "./events.recurrence";

type EventSeriesRow = {
  id: string;
  titleBg: string;
  titleEn: string;
  descriptionBg: string;
  descriptionEn: string;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  location: string;
  coverImagePath: string | null;
  frequency: string;
  byWeekdays: string[];
  recurrenceEndType: string | null;
  recurrenceCount: number | null;
  recurrenceUntil: Date | null;
  endsBeforeDate: Date | null;
  updatedAt: Date;
};

type EventExceptionRow = {
  occurrenceDate: Date;
  isCancelled: boolean;
  titleBg: string | null;
  titleEn: string | null;
  descriptionBg: string | null;
  descriptionEn: string | null;
  startAt: Date | null;
  endAt: Date | null;
  isAllDay: boolean | null;
  location: string | null;
  updatedAt: Date;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    private readonly uploadValidation: UploadValidationService,
    private readonly eventCoverStorage: EventCoverStorageService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {}

  async listRange(from: string, to: string): Promise<EventOccurrenceListResponse> {
    const today = todayInTimezone(this.env.OFFICE_TIMEZONE);
    const clampedTo = clampToHorizon(to, today);
    // A series whose very first occurrence starts after the window can have
    // no occurrence within it — a safe prefilter, not a correctness bound
    // (the real overlap filtering happens inside expandOccurrences).
    const upperBoundInstant = toDateOnly(addDays(clampedTo, 1));

    const seriesRows = await this.prisma.eventSeries.findMany({
      where: { startAt: { lt: upperBoundInstant } },
      include: { exceptions: true },
      orderBy: { startAt: "asc" },
    });

    const occurrences: EventOccurrence[] = [];
    for (const row of seriesRows) {
      const seriesForExpansion = toSeriesForExpansion(row, this.env.OFFICE_TIMEZONE);
      const exceptions = row.exceptions.map(toExceptionForExpansion);
      const expanded = expandOccurrences(seriesForExpansion, exceptions, from, clampedTo);
      for (const occurrence of expanded) {
        occurrences.push(toOccurrenceDto(row.id, row.frequency !== "NONE", row.updatedAt, occurrence));
      }
    }

    occurrences.sort((a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0));
    return { occurrences };
  }

  async getDetail(seriesId: string): Promise<EventSeriesDetail> {
    const row = await this.findSeriesOrThrow(seriesId);
    return toSeriesDetailDto(row);
  }

  async create(actorId: string, input: CreateEventRequest): Promise<EventSeriesDetail> {
    const row = await this.prisma.eventSeries.create({
      data: {
        titleBg: input.titleBg,
        titleEn: input.titleEn,
        descriptionBg: input.descriptionBg,
        descriptionEn: input.descriptionEn,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        isAllDay: input.isAllDay,
        location: input.location,
        ...recurrenceToColumns(input.recurrence),
      },
    });

    await this.audit.record({
      actorId,
      action: "event.created",
      targetType: "EventSeries",
      targetId: row.id,
      metadata: { titleEn: row.titleEn, isRecurring: row.frequency !== "NONE" },
    });
    this.domainEvents.emit("event.changed", { seriesId: row.id });

    return toSeriesDetailDto(row);
  }

  async updateSeries(
    actorId: string,
    seriesId: string,
    input: UpdateEventSeriesRequest,
  ): Promise<EventSeriesDetail> {
    const existing = await this.findSeriesOrThrow(seriesId);
    assertNotStale(existing.updatedAt, input.expectedUpdatedAt);

    const row = await this.prisma.eventSeries.update({
      where: { id: seriesId },
      data: {
        titleBg: input.titleBg,
        titleEn: input.titleEn,
        descriptionBg: input.descriptionBg,
        descriptionEn: input.descriptionEn,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        isAllDay: input.isAllDay,
        location: input.location,
        ...recurrenceToColumns(input.recurrence),
      },
    });

    await this.audit.record({
      actorId,
      action: "event.updated",
      targetType: "EventSeries",
      targetId: row.id,
      metadata: { scope: "SERIES", titleEn: row.titleEn },
    });
    this.domainEvents.emit("event.changed", { seriesId: row.id });

    return toSeriesDetailDto(row);
  }

  async deleteSeries(actorId: string, seriesId: string, expectedUpdatedAt: string): Promise<void> {
    const series = await this.findSeriesOrThrow(seriesId);
    assertNotStale(series.updatedAt, expectedUpdatedAt);

    await this.eventCoverStorage.removeIfExists(series.coverImagePath);
    // Cascades EventRecurrenceException rows (onDelete: Cascade).
    await this.prisma.eventSeries.delete({ where: { id: seriesId } });

    await this.audit.record({
      actorId,
      action: "event.deleted",
      targetType: "EventSeries",
      targetId: seriesId,
      metadata: { scope: "SERIES", titleEn: series.titleEn },
    });
    this.domainEvents.emit("event.changed", { seriesId });
  }

  async updateOccurrence(
    actorId: string,
    seriesId: string,
    occurrenceDate: string,
    input: UpdateEventOccurrenceRequest,
  ): Promise<void> {
    const series = await this.findSeriesOrThrow(seriesId);
    this.assertValidOccurrence(series, occurrenceDate);

    const occurrenceDateOnly = toDateOnly(occurrenceDate);
    const existing = await this.prisma.eventRecurrenceException.findUnique({
      where: { seriesId_occurrenceDate: { seriesId, occurrenceDate: occurrenceDateOnly } },
    });
    assertOccurrenceNotStale(existing, input.expectedUpdatedAt);

    const content = {
      titleBg: input.titleBg,
      titleEn: input.titleEn,
      descriptionBg: input.descriptionBg,
      descriptionEn: input.descriptionEn,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      isAllDay: input.isAllDay,
      location: input.location,
    };

    await this.prisma.eventRecurrenceException.upsert({
      where: { seriesId_occurrenceDate: { seriesId, occurrenceDate: occurrenceDateOnly } },
      create: { seriesId, occurrenceDate: occurrenceDateOnly, isCancelled: false, ...content },
      update: { isCancelled: false, ...content },
    });

    await this.audit.record({
      actorId,
      action: "event.updated",
      targetType: "EventSeries",
      targetId: seriesId,
      metadata: { scope: "OCCURRENCE", occurrenceDate },
    });
    this.domainEvents.emit("event.changed", { seriesId });
  }

  async deleteOccurrence(
    actorId: string,
    seriesId: string,
    occurrenceDate: string,
    expectedUpdatedAt: DeleteEventOccurrenceRequest["expectedUpdatedAt"],
  ): Promise<void> {
    const series = await this.findSeriesOrThrow(seriesId);
    this.assertValidOccurrence(series, occurrenceDate);

    const occurrenceDateOnly = toDateOnly(occurrenceDate);
    const existing = await this.prisma.eventRecurrenceException.findUnique({
      where: { seriesId_occurrenceDate: { seriesId, occurrenceDate: occurrenceDateOnly } },
    });
    assertOccurrenceNotStale(existing, expectedUpdatedAt);

    await this.prisma.eventRecurrenceException.upsert({
      where: { seriesId_occurrenceDate: { seriesId, occurrenceDate: occurrenceDateOnly } },
      create: { seriesId, occurrenceDate: occurrenceDateOnly, isCancelled: true },
      update: {
        isCancelled: true,
        titleBg: null,
        titleEn: null,
        descriptionBg: null,
        descriptionEn: null,
        startAt: null,
        endAt: null,
        isAllDay: null,
        location: null,
      },
    });

    await this.audit.record({
      actorId,
      action: "event.deleted",
      targetType: "EventSeries",
      targetId: seriesId,
      metadata: { scope: "OCCURRENCE", occurrenceDate },
    });
    this.domainEvents.emit("event.changed", { seriesId });
  }

  async updateSeriesFromOccurrence(
    actorId: string,
    seriesId: string,
    occurrenceDate: string,
    input: UpdateEventSeriesFromOccurrenceRequest,
  ): Promise<EventSeriesDetail> {
    const original = await this.findSeriesOrThrow(seriesId);
    assertNotStale(original.updatedAt, input.expectedUpdatedAt);

    const pattern = toPattern(original, this.env.OFFICE_TIMEZONE);
    const split = computeSplitForFutureEdit(pattern, occurrenceDate);
    if (!split) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "This edit scope is not available for that occurrence",
      );
    }

    const splitDateOnly = toDateOnly(occurrenceDate);

    const newSeries = await this.prisma.$transaction(async (tx) => {
      await tx.eventSeries.update({ where: { id: seriesId }, data: { endsBeforeDate: splitDateOnly } });

      const created = await tx.eventSeries.create({
        data: {
          titleBg: input.titleBg,
          titleEn: input.titleEn,
          descriptionBg: input.descriptionBg,
          descriptionEn: input.descriptionEn,
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          isAllDay: input.isAllDay,
          location: input.location,
          coverImagePath: original.coverImagePath,
          frequency: "WEEKLY",
          byWeekdays: original.byWeekdays as Weekday[],
          recurrenceEndType: original.recurrenceEndType as "COUNT" | "UNTIL",
          recurrenceCount: split.newRecurrenceCount,
          recurrenceUntil: original.recurrenceUntil,
          splitFromSeriesId: original.id,
        },
      });

      // The split point itself is now fully defined by the new series' own
      // fields, superseding any prior override at that exact date; anything
      // strictly after it moves with the pattern to the new series so it
      // isn't silently orphaned on the (now capped) original.
      await tx.eventRecurrenceException.deleteMany({ where: { seriesId, occurrenceDate: splitDateOnly } });
      await tx.eventRecurrenceException.updateMany({
        where: { seriesId, occurrenceDate: { gt: splitDateOnly } },
        data: { seriesId: created.id },
      });

      return created;
    });

    await this.audit.record({
      actorId,
      action: "event.updated",
      targetType: "EventSeries",
      targetId: newSeries.id,
      metadata: { scope: "THIS_AND_FUTURE", occurrenceDate, previousSeriesId: seriesId },
    });
    this.domainEvents.emit("event.changed", { seriesId: newSeries.id });

    return toSeriesDetailDto(newSeries);
  }

  async deleteSeriesFromOccurrence(
    actorId: string,
    seriesId: string,
    occurrenceDate: string,
    expectedUpdatedAt: string,
  ): Promise<void> {
    const series = await this.findSeriesOrThrow(seriesId);
    assertNotStale(series.updatedAt, expectedUpdatedAt);

    const pattern = toPattern(series, this.env.OFFICE_TIMEZONE);
    if (pattern.frequency !== "WEEKLY" || !isValidOccurrenceDate(pattern, occurrenceDate)) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "This delete scope is not available for that occurrence",
      );
    }

    const splitDateOnly = toDateOnly(occurrenceDate);
    await this.prisma.$transaction([
      this.prisma.eventSeries.update({ where: { id: seriesId }, data: { endsBeforeDate: splitDateOnly } }),
      this.prisma.eventRecurrenceException.deleteMany({
        where: { seriesId, occurrenceDate: { gte: splitDateOnly } },
      }),
    ]);

    await this.audit.record({
      actorId,
      action: "event.deleted",
      targetType: "EventSeries",
      targetId: seriesId,
      metadata: { scope: "THIS_AND_FUTURE", occurrenceDate },
    });
    this.domainEvents.emit("event.changed", { seriesId });
  }

  async replaceCover(actorId: string, seriesId: string, file: UploadedFileLike): Promise<EventCoverUploadResponse> {
    const series = await this.findSeriesOrThrow(seriesId);
    const previousPath = series.coverImagePath;

    const normalized = await this.uploadValidation.validateAndNormalizeEventCover(file);
    const newRelativePath = await this.eventCoverStorage.save(normalized.buffer, normalized.extension);

    let updated;
    try {
      updated = await this.prisma.eventSeries.update({
        where: { id: seriesId },
        data: { coverImagePath: newRelativePath },
      });
    } catch (error) {
      // The DB update failed: clean up the orphaned new file, leave the
      // previous (still-valid) cover untouched.
      await this.eventCoverStorage.removeIfExists(newRelativePath);
      throw error;
    }

    if (previousPath && previousPath !== newRelativePath) {
      await this.eventCoverStorage.removeIfExists(previousPath);
    }

    await this.audit.record({
      actorId,
      action: "event.cover_replaced",
      targetType: "EventSeries",
      targetId: seriesId,
    });

    return { coverImagePath: updated.coverImagePath as string };
  }

  async removeCover(actorId: string, seriesId: string): Promise<void> {
    const series = await this.findSeriesOrThrow(seriesId);
    if (!series.coverImagePath) {
      return;
    }

    await this.prisma.eventSeries.update({ where: { id: seriesId }, data: { coverImagePath: null } });
    await this.eventCoverStorage.removeIfExists(series.coverImagePath);

    await this.audit.record({
      actorId,
      action: "event.cover_removed",
      targetType: "EventSeries",
      targetId: seriesId,
    });
  }

  private async findSeriesOrThrow(seriesId: string): Promise<EventSeriesRow> {
    const row = await this.prisma.eventSeries.findUnique({ where: { id: seriesId } });
    if (!row) {
      throw new NotFoundException("Event not found");
    }
    return row;
  }

  private assertValidOccurrence(series: EventSeriesRow, occurrenceDate: string): void {
    const pattern = toPattern(series, this.env.OFFICE_TIMEZONE);
    if (!isValidOccurrenceDate(pattern, occurrenceDate)) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "That date is not an occurrence of this event",
      );
    }
  }
}

function recurrenceToColumns(recurrence: EventRecurrenceInput | undefined): {
  frequency: "NONE" | "WEEKLY";
  byWeekdays: Weekday[];
  recurrenceEndType: "COUNT" | "UNTIL" | null;
  recurrenceCount: number | null;
  recurrenceUntil: Date | null;
} {
  if (!recurrence) {
    return {
      frequency: "NONE",
      byWeekdays: [],
      recurrenceEndType: null,
      recurrenceCount: null,
      recurrenceUntil: null,
    };
  }
  return {
    frequency: "WEEKLY",
    byWeekdays: recurrence.byWeekdays,
    recurrenceEndType: recurrence.end.type,
    recurrenceCount: recurrence.end.type === "COUNT" ? recurrence.end.count : null,
    recurrenceUntil: recurrence.end.type === "UNTIL" ? toDateOnly(recurrence.end.until) : null,
  };
}

function toPattern(row: EventSeriesRow, officeTimezone: string): EventSeriesPattern {
  return {
    frequency: row.frequency as "NONE" | "WEEKLY",
    byWeekdays: row.byWeekdays as Weekday[],
    recurrenceEndType: row.recurrenceEndType as "COUNT" | "UNTIL" | null,
    recurrenceCount: row.recurrenceCount,
    recurrenceUntil: row.recurrenceUntil ? fromDateOnly(row.recurrenceUntil) : null,
    endsBeforeDate: row.endsBeforeDate ? fromDateOnly(row.endsBeforeDate) : null,
    anchorStartDate: dateInTimezone(row.startAt, officeTimezone),
  };
}

function toSeriesForExpansion(row: EventSeriesRow, officeTimezone: string): EventSeriesForExpansion {
  return {
    ...toPattern(row, officeTimezone),
    titleBg: row.titleBg,
    titleEn: row.titleEn,
    descriptionBg: row.descriptionBg,
    descriptionEn: row.descriptionEn,
    startAt: row.startAt,
    endAt: row.endAt,
    isAllDay: row.isAllDay,
    location: row.location,
    coverImagePath: row.coverImagePath,
    updatedAt: row.updatedAt,
  };
}

function toExceptionForExpansion(row: EventExceptionRow): EventExceptionForExpansion {
  return {
    occurrenceDate: fromDateOnly(row.occurrenceDate),
    isCancelled: row.isCancelled,
    override: row.isCancelled
      ? null
      : {
          titleBg: row.titleBg as string,
          titleEn: row.titleEn as string,
          descriptionBg: row.descriptionBg as string,
          descriptionEn: row.descriptionEn as string,
          startAt: row.startAt as Date,
          endAt: row.endAt as Date,
          isAllDay: row.isAllDay as boolean,
          location: row.location as string,
        },
    updatedAt: row.updatedAt,
  };
}

function toOccurrenceDto(
  seriesId: string,
  isRecurring: boolean,
  seriesUpdatedAt: Date,
  expanded: ExpandedOccurrence,
): EventOccurrence {
  return {
    seriesId,
    occurrenceDate: expanded.occurrenceDate,
    isRecurring,
    isException: expanded.isException,
    titleBg: expanded.content.titleBg,
    titleEn: expanded.content.titleEn,
    descriptionBg: expanded.content.descriptionBg,
    descriptionEn: expanded.content.descriptionEn,
    startAt: expanded.content.startAt.toISOString(),
    endAt: expanded.content.endAt.toISOString(),
    isAllDay: expanded.content.isAllDay,
    location: expanded.content.location,
    coverImagePath: expanded.coverImagePath,
    updatedAt: expanded.updatedAt.toISOString(),
    seriesUpdatedAt: seriesUpdatedAt.toISOString(),
  };
}

function toSeriesDetailDto(row: EventSeriesRow): EventSeriesDetail {
  return {
    id: row.id,
    titleBg: row.titleBg,
    titleEn: row.titleEn,
    descriptionBg: row.descriptionBg,
    descriptionEn: row.descriptionEn,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    isAllDay: row.isAllDay,
    location: row.location,
    coverImagePath: row.coverImagePath,
    recurrence:
      row.frequency === "NONE"
        ? null
        : {
            byWeekdays: row.byWeekdays as Weekday[],
            end:
              row.recurrenceEndType === "COUNT"
                ? { type: "COUNT", count: row.recurrenceCount as number }
                : { type: "UNTIL", until: fromDateOnly(row.recurrenceUntil as Date) },
          },
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertNotStale(currentUpdatedAt: Date, expectedUpdatedAt: string): void {
  if (currentUpdatedAt.toISOString() !== expectedUpdatedAt) {
    throw new AppError(
      HttpStatus.CONFLICT,
      "CONFLICT",
      "This event was changed by someone else. Reload and try again.",
    );
  }
}

function assertOccurrenceNotStale(
  existing: { updatedAt: Date } | null,
  expectedUpdatedAt: string | null,
): void {
  const currentIso = existing ? existing.updatedAt.toISOString() : null;
  if (currentIso !== expectedUpdatedAt) {
    throw new AppError(
      HttpStatus.CONFLICT,
      "CONFLICT",
      "This occurrence was changed by someone else. Reload and try again.",
    );
  }
}
