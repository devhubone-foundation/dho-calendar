import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  type AuthenticatedUser,
  calendarDateSchema,
  type CreateEventRequest,
  createEventRequestSchema,
  type DateRangeQuery,
  dateRangeQuerySchema,
  type DeleteEventOccurrenceRequest,
  deleteEventOccurrenceRequestSchema,
  type DeleteEventSeriesScopeRequest,
  deleteEventSeriesScopeRequestSchema,
  type EventCoverUploadResponse,
  type EventOccurrenceListResponse,
  type EventSeriesDetail,
  type UpdateEventOccurrenceRequest,
  updateEventOccurrenceRequestSchema,
  type UpdateEventSeriesFromOccurrenceRequest,
  updateEventSeriesFromOccurrenceRequestSchema,
  type UpdateEventSeriesRequest,
  updateEventSeriesRequestSchema,
} from "@dho/contracts";
import { memoryStorage } from "multer";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { EventsService } from "./events.service";

// A generous hard ceiling on request memory usage only. The authoritative
// 10 MB limit (ARCHITECTURE.md §13) is enforced with a clean error message by
// UploadValidationService; this just bounds abusive uploads before that.
const MULTER_MEMORY_SAFETY_LIMIT_BYTES = 20 * 1024 * 1024;

@Controller("events")
@UseGuards(RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: DateRangeQuery,
  ): Promise<EventOccurrenceListResponse> {
    return this.eventsService.listRange(query.from, query.to);
  }

  @Get(":seriesId")
  getDetail(@Param("seriesId") seriesId: string): Promise<EventSeriesDetail> {
    return this.eventsService.getDetail(seriesId);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(createEventRequestSchema)) body: CreateEventRequest,
  ): Promise<EventSeriesDetail> {
    return this.eventsService.create(actor.id, body);
  }

  @Patch(":seriesId")
  updateSeries(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("seriesId") seriesId: string,
    @Body(new ZodValidationPipe(updateEventSeriesRequestSchema)) body: UpdateEventSeriesRequest,
  ): Promise<EventSeriesDetail> {
    return this.eventsService.updateSeries(actor.id, seriesId, body);
  }

  @Delete(":seriesId")
  deleteSeries(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("seriesId") seriesId: string,
    @Body(new ZodValidationPipe(deleteEventSeriesScopeRequestSchema)) body: DeleteEventSeriesScopeRequest,
  ): Promise<void> {
    return this.eventsService.deleteSeries(actor.id, seriesId, body.expectedUpdatedAt);
  }

  @Put(":seriesId/occurrences/:date")
  updateOccurrence(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("seriesId") seriesId: string,
    @Param("date", new ZodValidationPipe(calendarDateSchema)) date: string,
    @Body(new ZodValidationPipe(updateEventOccurrenceRequestSchema)) body: UpdateEventOccurrenceRequest,
  ): Promise<void> {
    return this.eventsService.updateOccurrence(actor.id, seriesId, date, body);
  }

  @Delete(":seriesId/occurrences/:date")
  deleteOccurrence(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("seriesId") seriesId: string,
    @Param("date", new ZodValidationPipe(calendarDateSchema)) date: string,
    @Body(new ZodValidationPipe(deleteEventOccurrenceRequestSchema)) body: DeleteEventOccurrenceRequest,
  ): Promise<void> {
    return this.eventsService.deleteOccurrence(actor.id, seriesId, date, body.expectedUpdatedAt);
  }

  @Patch(":seriesId/occurrences/:date/future")
  updateSeriesFromOccurrence(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("seriesId") seriesId: string,
    @Param("date", new ZodValidationPipe(calendarDateSchema)) date: string,
    @Body(new ZodValidationPipe(updateEventSeriesFromOccurrenceRequestSchema))
    body: UpdateEventSeriesFromOccurrenceRequest,
  ): Promise<EventSeriesDetail> {
    return this.eventsService.updateSeriesFromOccurrence(actor.id, seriesId, date, body);
  }

  @Delete(":seriesId/occurrences/:date/future")
  deleteSeriesFromOccurrence(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("seriesId") seriesId: string,
    @Param("date", new ZodValidationPipe(calendarDateSchema)) date: string,
    @Body(new ZodValidationPipe(deleteEventSeriesScopeRequestSchema)) body: DeleteEventSeriesScopeRequest,
  ): Promise<void> {
    return this.eventsService.deleteSeriesFromOccurrence(actor.id, seriesId, date, body.expectedUpdatedAt);
  }

  @Post(":seriesId/cover")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_MEMORY_SAFETY_LIMIT_BYTES },
    }),
  )
  replaceCover(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("seriesId") seriesId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<EventCoverUploadResponse> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return this.eventsService.replaceCover(actor.id, seriesId, {
      buffer: file.buffer,
      size: file.size,
      mimetype: file.mimetype,
    });
  }

  @Delete(":seriesId/cover")
  removeCover(@CurrentUser() actor: AuthenticatedUser, @Param("seriesId") seriesId: string): Promise<void> {
    return this.eventsService.removeCover(actor.id, seriesId);
  }
}
