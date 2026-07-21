# Iframe Integration

How `devhubone.com` embeds the public calendar (PRODUCT_BLUEPRINT.md §21, ARCHITECTURE.md §15).

## Basic embed

```html
<iframe
  id="dho-calendar"
  src="https://calendar.devhubone.com/?lang=bg&view=week"
  title="DevHubOne office calendar"
  width="100%"
  style="border: 0; min-height: 480px;"
></iframe>
```

- `lang=bg|en` — missing or unsupported values fall back to `en`.
- `view=month|week|day|list` — missing or unsupported values fall back to `week` (the documented default).
- Do not set `scrolling="no"` unless the parent script below is installed — without it, the iframe never resizes and needs its own scrollbar.

## Auto-resize protocol

The calendar posts a message to `window.parent` on load, on every view/modal change, and on any other content-size change (debounced ~100ms):

```json
{ "source": "dho-office-calendar", "type": "resize", "height": 1240 }
```

The message target origin is `"*"` — Version 1 does not restrict which domains may embed the calendar (ARCHITECTURE.md §15). The parent is responsible for validating both the message shape and the sender's origin before trusting it.

### Parent-side listener

```html
<script>
  (function () {
    var iframe = document.getElementById("dho-calendar");
    var expectedOrigin = new URL(iframe.src).origin;
    var MIN_HEIGHT = 480; // px — usable on narrow/mobile parent layouts
    var MAX_HEIGHT = 4000; // px — sanity ceiling against a malformed payload

    window.addEventListener("message", function (event) {
      if (event.origin !== expectedOrigin) return; // reject any other sender
      var data = event.data;
      if (
        !data ||
        data.source !== "dho-office-calendar" ||
        data.type !== "resize" ||
        typeof data.height !== "number" ||
        data.height <= 0
      ) {
        return; // malformed payload — ignore
      }
      var height = Math.min(Math.max(data.height, MIN_HEIGHT), MAX_HEIGHT);
      iframe.style.height = height + "px";
    });
  })();
</script>
```

`packages/contracts/src/realtime.ts`'s `resizeMessageSchema`/`isResizeMessage` is the shared source of truth for this shape on the calendar side; the snippet above is a dependency-free mirror for the parent site, which lives in a separate repository.

### Timing

| Trigger | When |
|---|---|
| Initial load | Once the first calendar data fetch resolves |
| View switch (Month/Week/Day/Upcoming) | Immediately after the new view renders |
| Day-details modal open/close | Immediately after |
| Any other DOM size change | Debounced ~100ms via `ResizeObserver` (catch-all) |

### Fallback without JavaScript / postMessage

If the parent page cannot run the listener script (JS disabled, strict CSP blocking inline scripts, etc.), give the iframe a fixed height generous enough for the default Week view on a typical viewport (900–1100px) and allow native scrolling (do not set `scrolling="no"`, and drop the `min-height` inline style above in favor of a fixed `height`). The calendar page itself never assumes it is being resized — it renders correctly at any iframe height, just with internal scrolling if the frame is shorter than its content.

## Realtime updates

The calendar connects to the realtime WebSocket gateway for live invalidation (`office-schedule.changed`, `attendance.changed`, `event.changed`, `profile.changed`, `member-status.changed`) and re-fetches the public REST endpoint when one arrives. This is entirely internal to the calendar iframe — the parent page does not need to do anything for it, and the calendar stays correct (via its normal polling-free, fetch-on-navigation behavior) even if the socket never connects.

## Production / Render embed

Once deployed on Render (see [`docs/RENDER_DEPLOY.md`](RENDER_DEPLOY.md)), embed the assigned public URL the same way:

```html
<iframe
  id="dho-calendar"
  src="https://dho-calendar.onrender.com/?lang=bg&view=week"
  title="DevHubOne office calendar"
  width="100%"
  style="border: 0; min-height: 480px;"
></iframe>
```

The Nginx reverse proxy (`docker/nginx/nginx.conf.template`, used by both the local `prod` Compose profile and the Render deployment image) forwards the WebSocket upgrade handshake (`Connection: Upgrade` / `Upgrade: websocket`) for `/socket.io/` and applies a `client_max_body_size` well above the largest allowed upload, so realtime updates and image uploads both work behind it.
