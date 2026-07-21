import { z } from "zod";

/** ARCHITECTURE.md §13: profile images are JPEG/PNG/WebP, max 5 MB. */
export const PROFILE_PICTURE_MAX_BYTES = 5 * 1024 * 1024;

export const PROFILE_PICTURE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ProfilePictureMimeType = (typeof PROFILE_PICTURE_ALLOWED_MIME_TYPES)[number];

export const profilePictureUploadResponseSchema = z.object({
  /** Relative path stored in the database, e.g. "profiles/<uuid>.webp". */
  profileImagePath: z.string(),
});
export type ProfilePictureUploadResponse = z.infer<typeof profilePictureUploadResponseSchema>;
