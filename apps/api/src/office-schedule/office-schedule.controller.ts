import { Body, Controller, Delete, Get, Param, Patch, Put, Query, UseGuards } from "@nestjs/common";
import {
  type AuthenticatedUser,
  type OfficeEffectiveRangeResponse,
  type OfficeScheduleDefaultsResponse,
  type OfficeScheduleException,
  type OfficeScheduleExceptionInput,
  officeScheduleExceptionInputSchema,
  type OfficeScheduleExceptionListResponse,
  type UpdateOfficeDefaultsRequest,
  updateOfficeDefaultsRequestSchema,
  calendarDateSchema,
  type DateRangeQuery,
  dateRangeQuerySchema,
} from "@dho/contracts";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { OfficeScheduleService } from "./office-schedule.service";

@Controller("office-schedule")
@UseGuards(RolesGuard)
export class OfficeScheduleController {
  constructor(private readonly officeScheduleService: OfficeScheduleService) {}

  @Get("defaults")
  getDefaults(): Promise<OfficeScheduleDefaultsResponse> {
    return this.officeScheduleService.getDefaults();
  }

  @Roles("ADMIN")
  @Patch("defaults")
  updateDefaults(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateOfficeDefaultsRequestSchema)) body: UpdateOfficeDefaultsRequest,
  ): Promise<OfficeScheduleDefaultsResponse> {
    return this.officeScheduleService.updateDefaults(actor.id, body);
  }

  @Get("exceptions")
  listExceptions(
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: DateRangeQuery,
  ): Promise<OfficeScheduleExceptionListResponse> {
    return this.officeScheduleService.listExceptions(query.from, query.to);
  }

  @Roles("ADMIN")
  @Put("exceptions/:date")
  upsertException(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("date", new ZodValidationPipe(calendarDateSchema)) date: string,
    @Body(new ZodValidationPipe(officeScheduleExceptionInputSchema)) body: OfficeScheduleExceptionInput,
  ): Promise<OfficeScheduleException> {
    return this.officeScheduleService.upsertException(actor.id, date, body);
  }

  @Roles("ADMIN")
  @Delete("exceptions/:date")
  deleteException(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("date", new ZodValidationPipe(calendarDateSchema)) date: string,
  ): Promise<void> {
    return this.officeScheduleService.deleteException(actor.id, date);
  }

  @Get("effective")
  async resolveRange(
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: DateRangeQuery,
  ): Promise<OfficeEffectiveRangeResponse> {
    return { days: await this.officeScheduleService.resolveRange(query.from, query.to) };
  }
}
