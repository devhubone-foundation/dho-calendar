import { Body, Controller, Delete, Get, Param, Patch, Put, Query, UseGuards } from "@nestjs/common";
import {
  type AttendanceException,
  type AttendanceExceptionInput,
  attendanceExceptionInputSchema,
  type AttendanceExceptionListResponse,
  type AttendanceWarningListResponse,
  type AuthenticatedUser,
  calendarDateSchema,
  type DateRangeQuery,
  dateRangeQuerySchema,
  type MemberEffectiveAttendanceRangeResponse,
  type MemberWeeklyScheduleResponse,
  type UpdateWeeklyScheduleRequest,
  updateWeeklyScheduleRequestSchema,
} from "@dho/contracts";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AttendanceService } from "./attendance.service";

@Controller("attendance")
@UseGuards(RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // --- Self routes: always act on the caller's own userId, so a member can
  // never reach another member's attendance through these paths. ---

  @Get("me/weekly")
  getOwnWeeklySchedule(@CurrentUser() user: AuthenticatedUser): Promise<MemberWeeklyScheduleResponse> {
    return this.attendanceService.getWeeklySchedule(user.id);
  }

  @Patch("me/weekly")
  updateOwnWeeklySchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateWeeklyScheduleRequestSchema)) body: UpdateWeeklyScheduleRequest,
  ): Promise<MemberWeeklyScheduleResponse> {
    return this.attendanceService.updateWeeklySchedule(user.id, user.id, body);
  }

  @Get("me/exceptions")
  listOwnExceptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: DateRangeQuery,
  ): Promise<AttendanceExceptionListResponse> {
    return this.attendanceService.listExceptions(user.id, query.from, query.to);
  }

  @Put("me/exceptions/:date")
  upsertOwnException(
    @CurrentUser() user: AuthenticatedUser,
    @Param("date", new ZodValidationPipe(calendarDateSchema)) date: string,
    @Body(new ZodValidationPipe(attendanceExceptionInputSchema)) body: AttendanceExceptionInput,
  ): Promise<AttendanceException> {
    return this.attendanceService.upsertException(user.id, user.id, date, body);
  }

  @Delete("me/exceptions/:date")
  deleteOwnException(
    @CurrentUser() user: AuthenticatedUser,
    @Param("date", new ZodValidationPipe(calendarDateSchema)) date: string,
  ): Promise<void> {
    return this.attendanceService.deleteException(user.id, user.id, date);
  }

  @Get("me/effective")
  async resolveOwnRange(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: DateRangeQuery,
  ): Promise<MemberEffectiveAttendanceRangeResponse> {
    return { days: await this.attendanceService.resolveRange(user.id, query.from, query.to) };
  }

  // --- Admin routes: any active member's attendance, by :userId. ---

  @Roles("ADMIN")
  @Get("members/:userId/weekly")
  getMemberWeeklySchedule(@Param("userId") userId: string): Promise<MemberWeeklyScheduleResponse> {
    return this.attendanceService.getWeeklySchedule(userId);
  }

  @Roles("ADMIN")
  @Patch("members/:userId/weekly")
  updateMemberWeeklySchedule(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(updateWeeklyScheduleRequestSchema)) body: UpdateWeeklyScheduleRequest,
  ): Promise<MemberWeeklyScheduleResponse> {
    return this.attendanceService.updateWeeklySchedule(actor.id, userId, body);
  }

  @Roles("ADMIN")
  @Get("members/:userId/exceptions")
  listMemberExceptions(
    @Param("userId") userId: string,
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: DateRangeQuery,
  ): Promise<AttendanceExceptionListResponse> {
    return this.attendanceService.listExceptions(userId, query.from, query.to);
  }

  @Roles("ADMIN")
  @Put("members/:userId/exceptions/:date")
  upsertMemberException(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: string,
    @Param("date", new ZodValidationPipe(calendarDateSchema)) date: string,
    @Body(new ZodValidationPipe(attendanceExceptionInputSchema)) body: AttendanceExceptionInput,
  ): Promise<AttendanceException> {
    return this.attendanceService.upsertException(actor.id, userId, date, body);
  }

  @Roles("ADMIN")
  @Delete("members/:userId/exceptions/:date")
  deleteMemberException(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: string,
    @Param("date", new ZodValidationPipe(calendarDateSchema)) date: string,
  ): Promise<void> {
    return this.attendanceService.deleteException(actor.id, userId, date);
  }

  @Roles("ADMIN")
  @Get("members/:userId/effective")
  async resolveMemberRange(
    @Param("userId") userId: string,
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: DateRangeQuery,
  ): Promise<MemberEffectiveAttendanceRangeResponse> {
    return { days: await this.attendanceService.resolveRange(userId, query.from, query.to) };
  }

  @Roles("ADMIN")
  @Get("warnings")
  getWarnings(): Promise<AttendanceWarningListResponse> {
    return this.attendanceService.computeWarnings();
  }
}
