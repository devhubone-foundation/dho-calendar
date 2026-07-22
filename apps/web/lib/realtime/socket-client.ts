"use client";

import { useEffect } from "react";
import type { SocketEventName } from "@dho/contracts";
import { io } from "socket.io-client";

// Empty when NEXT_PUBLIC_WS_ORIGIN is unset (the intended production/Render
// config, see render.yaml/Dockerfile.render): in that case we connect to the
// page's own origin so Nginx proxies the /socket.io/ upgrade to the API on the
// same host, mirroring the same-origin REST fallback in lib/auth/api-client.ts.
const WS_ORIGIN = process.env.NEXT_PUBLIC_WS_ORIGIN || undefined;

const INVALIDATION_EVENTS: SocketEventName[] = [
  "office-schedule.changed",
  "attendance.changed",
  "event.changed",
  "profile.changed",
  "member-status.changed",
];

/**
 * Subscribes to the realtime invalidation gateway (ARCHITECTURE.md §9) and
 * calls `onInvalidate` whenever a relevant domain event arrives, and again on
 * every (re)connect so a client that missed events while disconnected still
 * refreshes on reconnect. REST stays authoritative — this hook never reads
 * the socket payload as display data, only as a signal to re-fetch, and the
 * calendar remains correct if the socket never connects at all (the initial
 * REST fetch on mount is unaffected). Pass a `useCallback`-stable
 * `onInvalidate` so this doesn't reconnect on every render.
 */
export function useRealtimeInvalidation(onInvalidate: () => void): void {
  useEffect(() => {
    const socket = io(WS_ORIGIN, { transports: ["websocket"], reconnection: true });

    socket.on("connect", onInvalidate);
    for (const eventName of INVALIDATION_EVENTS) {
      socket.on(eventName, onInvalidate);
    }

    return () => {
      socket.disconnect();
    };
  }, [onInvalidate]);
}
