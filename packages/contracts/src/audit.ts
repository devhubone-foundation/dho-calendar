import { z } from "zod";

/** GET /api/audit response entry (ADMIN-only, PRODUCT_BLUEPRINT.md §20).
 * `metadata` is a structured before/after or summary snapshot and never
 * contains passwords, hashes, or tokens (enforced at the write path in
 * `AuditService.record`, not here). */
export const auditLogEntrySchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  /** The actor's login/contact email at read time, resolved server-side for
   * display — null when the actor account no longer exists (User.actorId
   * uses onDelete: SetNull) or the action had no human actor. */
  actorEmail: z.string().nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const auditLogListResponseSchema = z.object({
  entries: z.array(auditLogEntrySchema),
});
export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>;
