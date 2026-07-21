import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { UploadsModule } from "../uploads/uploads.module";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

@Module({
  imports: [UploadsModule, AuditModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
