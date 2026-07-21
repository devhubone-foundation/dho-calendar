/** PRODUCT_BLUEPRINT.md §20.4: audit records are retained for seven days from
 * creation. This is a fixed product rule, not an admin-configurable setting
 * (unlike, e.g., ATTENDANCE_WARNING_LOOKAHEAD_DAYS), so it lives as a named
 * constant rather than an environment variable. */
export const AUDIT_RETENTION_DAYS = 7;
