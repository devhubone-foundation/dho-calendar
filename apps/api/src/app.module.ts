import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AttendanceModule } from "./attendance/attendance.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAccessGuard } from "./common/guards/jwt-access.guard";
import { DomainEventsModule } from "./common/domain-events/domain-events.module";
import { ConfigModule } from "./config/config.module";
import { EventsModule } from "./events/events.module";
import { HealthModule } from "./health/health.module";
import { OfficeScheduleModule } from "./office-schedule/office-schedule.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { UploadsModule } from "./uploads/uploads.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    DomainEventsModule,
    HealthModule,
    AuthModule,
    AuditModule,
    UploadsModule,
    ProfilesModule,
    UsersModule,
    OfficeScheduleModule,
    AttendanceModule,
    EventsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAccessGuard }],
})
export class AppModule {}
