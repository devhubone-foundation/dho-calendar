import { Controller, Get, UseGuards } from "@nestjs/common";

import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Minimal ADMIN-only foundation endpoint over the AuditLog stub. Retention,
 * cleanup scheduling, and the full audit UI belong to Issue #5.
 */
@Controller("audit")
@UseGuards(RolesGuard)
@Roles("ADMIN")
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
