import { describe, expect, it } from "vitest";

import {
  PROFILE_PICTURE_ALLOWED_MIME_TYPES,
  PROFILE_PICTURE_MAX_BYTES,
  profilePictureUploadResponseSchema,
} from "./uploads";

describe("upload constants", () => {
  it("caps profile pictures at 5 MB per ARCHITECTURE.md §13", () => {
    expect(PROFILE_PICTURE_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it("allows exactly JPEG, PNG, and WebP", () => {
    expect(PROFILE_PICTURE_ALLOWED_MIME_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});

describe("profilePictureUploadResponseSchema", () => {
  it("accepts a relative path", () => {
    expect(() =>
      profilePictureUploadResponseSchema.parse({ profileImagePath: "profiles/abc.webp" }),
    ).not.toThrow();
  });
});
