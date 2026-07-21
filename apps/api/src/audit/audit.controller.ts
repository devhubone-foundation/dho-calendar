import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuditLogListResponse } from "@dho/contracts";

import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuditService } from "./audit.service";

/** ADMIN-only audit history (PRODUCT_BLUEPRINT.md §20): always the last
 * seven days, never an expired record — retention is enforced by
 * `AuditService.findRecent` and permanently by the daily cleanup job. */
@Controller("audit")
@UseGuards(RolesGuard)
@Roles("ADMIN")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(): Promise<AuditLogListResponse> {
    return this.audit.findRecent().then((entries) => ({ entries }));
  }
}
