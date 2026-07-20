import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAccessGuard } from "./common/guards/jwt-access.guard";
import { ConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule, AuthModule, AuditModule],
  providers: [{ provide: APP_GUARD, useClass: JwtAccessGuard }],
})
export class AppModule {}
