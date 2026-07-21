import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { OfficeScheduleController } from "./office-schedule.controller";
import { OfficeScheduleService } from "./office-schedule.service";

@Module({
  imports: [AuditModule],
  controllers: [OfficeScheduleController],
  providers: [OfficeScheduleService],
  exports: [OfficeScheduleService],
})
export class OfficeScheduleModule {}
