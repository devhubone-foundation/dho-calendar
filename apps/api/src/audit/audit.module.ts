import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { AuditCleanupService } from "./audit-cleanup.service";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AuditController],
  providers: [AuditService, AuditCleanupService],
  exports: [AuditService],
})
export class AuditModule {}
