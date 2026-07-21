import { isResizeMessage, RESIZE_MESSAGE_SOURCE } from "@dho/contracts";
import { describe, expect, it } from "vitest";

import { buildResizeMessage } from "./resize";

describe("buildResizeMessage", () => {
  it("builds a message matching the shared resize contract", () => {
    const message = buildResizeMessage(640);
    expect(message).toEqual({ source: RESIZE_MESSAGE_SOURCE, type: "resize", height: 640 });
    expect(isResizeMessage(message)).toBe(true);
  });

  it("rounds a fractional height up so content is never clipped", () => {
    expect(buildResizeMessage(639.2)).toMatchObject({ height: 640 });
  });

  it("throws for a non-positive height instead of posting a malformed message", () => {
    expect(() => buildResizeMessage(0)).toThrow();
    expect(() => buildResizeMessage(-10)).toThrow();
  });
});
