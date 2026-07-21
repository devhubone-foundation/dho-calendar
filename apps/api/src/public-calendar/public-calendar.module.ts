import { Module } from "@nestjs/common";

import { AttendanceModule } from "../attendance/attendance.module";
import { EventsModule } from "../events/events.module";
import { OfficeScheduleModule } from "../office-schedule/office-schedule.module";
import { PublicCalendarController } from "./public-calendar.controller";
import { PublicCalendarService } from "./public-calendar.service";

@Module({
  imports: [OfficeScheduleModule, AttendanceModule, EventsModule],
  controllers: [PublicCalendarController],
  providers: [PublicCalendarService],
})
export class PublicCalendarModule {}
