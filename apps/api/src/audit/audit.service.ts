import { Injectable } from "@nestjs/common";
import type { AuditLogEntry } from "@dho/contracts";
import type { Prisma } from "@dho/database";

import { PrismaService } from "../prisma/prisma.service";
import { AUDIT_RETENTION_DAYS } from "./audit.constants";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    actorId: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata,
      },
    });
  }

  /** GET /api/audit (ADMIN-only): every entry within the seven-day retention
   * window (PRODUCT_BLUEPRINT.md §20.4) — never an expired record. Resolves
   * the actor's current email for display (PRODUCT_BLUEPRINT.md §20.3). */
  async findRecent(): Promise<AuditLogEntry[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { createdAt: { gte: retentionCutoff() } },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { email: true } } },
    });
    return rows.map(toAuditLogEntryDto);
  }

  /** Permanently deletes every record older than the retention window.
   * Called by the daily `AuditCleanupService` cron job. */
  async deleteExpired(): Promise<number> {
    const result = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: retentionCutoff() } },
    });
    return result.count;
  }
}

function retentionCutoff(): Date {
  return new Date(Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function toAuditLogEntryDto(row: {
  id: string;
  actorId: string | null;
  actor: { email: string } | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: unknown;
  createdAt: Date;
}): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actorId,
    actorEmail: row.actor?.email ?? null,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}
