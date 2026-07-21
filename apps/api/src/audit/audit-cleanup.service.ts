import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { AUDIT_RETENTION_DAYS } from "./audit.constants";
import { AuditService } from "./audit.service";

// @Cron's options are resolved at method-decoration time, before Nest's
// dependency injection runs (same constraint as RealtimeGateway's CORS
// origin — see apps/api/src/realtime/realtime.gateway.ts), so the timezone
// cannot come from an injected APP_ENV provider here.
const CLEANUP_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "Europe/Sofia";

/** Daily scheduled job permanently deleting audit records older than the
 * seven-day retention window (PRODUCT_BLUEPRINT.md §20.4/ARCHITECTURE.md
 * §20). Runs at 03:00 in the configured office timezone — a low-traffic hour
 * for a single-office, single-timezone deployment. */
@Injectable()
export class AuditCleanupService {
  private readonly logger = new Logger(AuditCleanupService.name);

  constructor(private readonly audit: AuditService) {}

  @Cron("0 3 * * *", { timeZone: CLEANUP_TIMEZONE })
  async handleCleanup(): Promise<void> {
    const deleted = await this.audit.deleteExpired();
    if (deleted > 0) {
      this.logger.log(
        `Deleted ${deleted} audit log entr${deleted === 1 ? "y" : "ies"} older than ${AUDIT_RETENTION_DAYS} days`,
      );
    }
  }
}
