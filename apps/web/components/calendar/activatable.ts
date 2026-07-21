import type { KeyboardEvent } from "react";

/** Spreadable props that make any element (not just a real `<button>`)
 * keyboard-activatable with Enter/Space, without the invalid-HTML nested-
 * interactive-content problems a literal `<button>` would cause when these
 * elements are nested (e.g. an event chip inside a clickable day cell). */
export function activatableProps(onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
