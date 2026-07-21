import { EventEmitter } from "node:events";

import { Injectable } from "@nestjs/common";

/**
 * Domain-change signal names ARCHITECTURE.md §9 lists for the realtime
 * gateway (owned by Issue #5). This service only emits/exposes them
 * in-process via Node's built-in EventEmitter — it does not broadcast
 * anything itself. Issue #5 subscribes with `.on(...)` when it builds the
 * WebSocket gateway.
 */
export interface DomainEventPayloads {
  "office-schedule.changed": { from: string; to: string };
  "attendance.changed": { userId: string; from: string; to: string };
  "member-status.changed": { userId: string };
  "event.changed": { seriesId: string };
}

export type DomainEventName = keyof DomainEventPayloads;

@Injectable()
export class DomainEventsService {
  private readonly emitter = new EventEmitter();

  emit<E extends DomainEventName>(event: E, payload: DomainEventPayloads[E]): void {
    this.emitter.emit(event, payload);
  }

  on<E extends DomainEventName>(event: E, listener: (payload: DomainEventPayloads[E]) => void): void {
    this.emitter.on(event, listener);
  }
}
