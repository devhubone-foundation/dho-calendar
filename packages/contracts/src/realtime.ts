import { z } from "zod";

import { calendarDateSchema } from "./calendar-date";

/**
 * WebSocket invalidation events (ARCHITECTURE.md §9). The gateway broadcasts
 * these to every connected client (public and authenticated alike) whenever
 * the matching domain-change signal fires server-side. Payloads carry only
 * entity references needed to decide what to re-fetch — never displayed
 * profile/attendance/event content — so there is nothing sensitive to leak
 * even to an unauthenticated public client.
 */
export const socketEventNameSchema = z.enum([
  "office-schedule.changed",
  "attendance.changed",
  "event.changed",
  "profile.changed",
  "member-status.changed",
]);
export type SocketEventName = z.infer<typeof socketEventNameSchema>;

export const officeScheduleChangedPayloadSchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
});
export type OfficeScheduleChangedPayload = z.infer<typeof officeScheduleChangedPayloadSchema>;

export const attendanceChangedPayloadSchema = z.object({
  userId: z.string(),
  from: calendarDateSchema,
  to: calendarDateSchema,
});
export type AttendanceChangedPayload = z.infer<typeof attendanceChangedPayloadSchema>;

export const eventChangedPayloadSchema = z.object({
  seriesId: z.string(),
});
export type EventChangedPayload = z.infer<typeof eventChangedPayloadSchema>;

export const profileChangedPayloadSchema = z.object({
  userId: z.string(),
});
export type ProfileChangedPayload = z.infer<typeof profileChangedPayloadSchema>;

export const memberStatusChangedPayloadSchema = z.object({
  userId: z.string(),
});
export type MemberStatusChangedPayload = z.infer<typeof memberStatusChangedPayloadSchema>;

/** The namespaced iframe resize message (ARCHITECTURE.md §15). The parent
 * page on devhubone.com validates both the message shape (via this schema)
 * and the sender's `event.origin` before applying `height`. */
export const RESIZE_MESSAGE_SOURCE = "dho-office-calendar";

export const resizeMessageSchema = z.object({
  source: z.literal(RESIZE_MESSAGE_SOURCE),
  type: z.literal("resize"),
  height: z.number().positive(),
});
export type ResizeMessage = z.infer<typeof resizeMessageSchema>;

/** Type guard for validating an arbitrary `postMessage` payload before
 * trusting it as a resize message — used by both the calendar iframe (as a
 * defensive check on its own outgoing payload) and documented for the parent
 * integration script to mirror. */
export function isResizeMessage(value: unknown): value is ResizeMessage {
  return resizeMessageSchema.safeParse(value).success;
}
