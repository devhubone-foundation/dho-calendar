import type { OnModuleInit } from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";

import { type DomainEventName, DomainEventsService } from "../common/domain-events/domain-events.service";

/** Every domain-change signal broadcast to connected clients (ARCHITECTURE.md
 * §9). Payloads are thin entity references only — never displayed
 * profile/attendance/event content — so the same broadcast is safe to send
 * to public and authenticated clients alike; a client's job on receipt is
 * only to re-fetch the relevant REST query, never to trust the payload as
 * display data. */
const BROADCAST_EVENTS: DomainEventName[] = [
  "office-schedule.changed",
  "attendance.changed",
  "event.changed",
  "profile.changed",
  "member-status.changed",
];

// @WebSocketGateway's options are resolved at class-decoration time, before
// Nest's dependency injection runs, so they cannot come from an injected
// APP_ENV provider (unlike every other service in this app). `main.ts`
// imports "dotenv/config" before the module tree loads, so `process.env` is
// already populated by the time this file is evaluated in a real bootstrap;
// the fallback only applies to contexts (unit tests) that import this file
// without going through main.ts at all.
const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";

/**
 * Realtime invalidation gateway (ARCHITECTURE.md §7.9/§9). Subscribes to the
 * in-process `DomainEventsService` (populated by the office-schedule,
 * attendance, events, profiles, and users services) and re-broadcasts each
 * signal to every connected Socket.IO client — public and authenticated
 * alike, on the single default namespace, since payloads carry nothing
 * sensitive. REST remains the authoritative data source; a reconnecting
 * client is expected to perform a full re-fetch rather than trust anything
 * it may have missed while disconnected.
 */
@WebSocketGateway({ cors: { origin: APP_ORIGIN, credentials: true } })
export class RealtimeGateway implements OnModuleInit {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly domainEvents: DomainEventsService) {}

  onModuleInit(): void {
    for (const eventName of BROADCAST_EVENTS) {
      this.domainEvents.on(eventName, (payload) => {
        this.server.emit(eventName, payload);
      });
    }
  }
}
