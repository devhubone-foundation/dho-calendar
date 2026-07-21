import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { OfficeScheduleModule } from "../office-schedule/office-schedule.module";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";

@Module({
  imports: [AuditModule, OfficeScheduleModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
