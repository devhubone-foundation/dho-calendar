import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { UploadsModule } from "../uploads/uploads.module";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  imports: [AuditModule, UploadsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
