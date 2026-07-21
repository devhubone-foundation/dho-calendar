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

/** ARCHITECTURE.md §13: event covers are JPEG/PNG/WebP, max 10 MB. */
export const EVENT_COVER_MAX_BYTES = 10 * 1024 * 1024;

export const EVENT_COVER_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type EventCoverMimeType = (typeof EVENT_COVER_ALLOWED_MIME_TYPES)[number];

export const eventCoverUploadResponseSchema = z.object({
  /** Relative path stored in the database, e.g. "events/<uuid>.webp". */
  coverImagePath: z.string(),
});
export type EventCoverUploadResponse = z.infer<typeof eventCoverUploadResponseSchema>;
