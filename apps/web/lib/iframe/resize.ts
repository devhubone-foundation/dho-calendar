"use client";

import { type RefObject, useEffect, useRef } from "react";
import { isResizeMessage, RESIZE_MESSAGE_SOURCE, type ResizeMessage } from "@dho/contracts";

const RESIZE_DEBOUNCE_MS = 100;

/** Builds the namespaced resize payload (ARCHITECTURE.md §15). Pure and
 * independently testable; height is rounded up so the parent never clips a
 * fractional pixel of content. */
export function buildResizeMessage(height: number): ResizeMessage {
  const message = { source: RESIZE_MESSAGE_SOURCE, type: "resize" as const, height: Math.ceil(height) };
  if (!isResizeMessage(message)) {
    throw new Error(`Invalid resize height: ${height}`);
  }
  return message;
}

function postResizeMessage(height: number): void {
  if (typeof window === "undefined" || window.parent === window) {
    return; // Standalone (not embedded) — nothing to report.
  }
  // Version 1 does not restrict which domains may embed the calendar
  // (PRODUCT_BLUEPRINT.md §21.2), so the target origin is deliberately "*";
  // the parent-side script validates the message shape and its own expected
  // source origin before applying the height (see docs/iframe-integration.md).
  window.parent.postMessage(buildResizeMessage(height), "*");
}

/**
 * Reports this page's rendered content height to an embedding parent window
 * (ARCHITECTURE.md §15): once on mount, on every `deps` change (view
 * switches, modal open/close, calendar data load), and on any other DOM size
 * change via a debounced `ResizeObserver` as a catch-all. No-op outside an
 * iframe.
 */
export function useIframeResize(containerRef: RefObject<HTMLElement | null>, deps: unknown[]): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    function report(): void {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (node) postResizeMessage(node.getBoundingClientRect().height);
      }, RESIZE_DEBOUNCE_MS);
    }

    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
