import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EVENT_COVER_ALLOWED_MIME_TYPES,
  EVENT_COVER_MAX_BYTES,
  PROFILE_PICTURE_ALLOWED_MIME_TYPES,
  PROFILE_PICTURE_MAX_BYTES,
} from "@dho/contracts";
import sharp from "sharp";

import { AppError } from "../common/errors/app-error";

const PROFILE_PICTURE_MAX_DIMENSION = 512;
const PROFILE_PICTURE_WEBP_QUALITY = 82;
const EVENT_COVER_MAX_DIMENSION = 1920;
const EVENT_COVER_WEBP_QUALITY = 82;
const ALLOWED_SHARP_FORMATS = ["jpeg", "png", "webp"] as const;

export interface UploadedFileLike {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

export interface NormalizedImage {
  buffer: Buffer;
  extension: "webp";
}

export type NormalizedProfilePicture = NormalizedImage;
export type NormalizedEventCover = NormalizedImage;

/**
 * Validates and normalizes profile-picture and event-cover uploads per
 * ARCHITECTURE.md §13: JPEG/PNG/WebP, max 5 MB / 10 MB respectively. Every
 * accepted file is re-encoded through sharp, which doubles as the "content"
 * check (sharp rejects anything that doesn't decode as a real image, not
 * just a spoofed MIME header), strips EXIF metadata, and normalizes output to
 * WebP so stored filenames never depend on client-supplied extensions. Both
 * upload kinds share the same MIME/size/content validation, differing only
 * in their limits and the target max dimension (event covers are a wide
 * poster-style image, not a small square avatar).
 */
@Injectable()
export class UploadValidationService {
  async validateAndNormalizeProfilePicture(file: UploadedFileLike): Promise<NormalizedProfilePicture> {
    const image = await this.decodeImage(file, PROFILE_PICTURE_ALLOWED_MIME_TYPES, PROFILE_PICTURE_MAX_BYTES);
    const buffer = await image
      .rotate()
      .resize(PROFILE_PICTURE_MAX_DIMENSION, PROFILE_PICTURE_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: PROFILE_PICTURE_WEBP_QUALITY })
      .toBuffer();
    return { buffer, extension: "webp" };
  }

  async validateAndNormalizeEventCover(file: UploadedFileLike): Promise<NormalizedEventCover> {
    const image = await this.decodeImage(file, EVENT_COVER_ALLOWED_MIME_TYPES, EVENT_COVER_MAX_BYTES);
    const buffer = await image
      .rotate()
      .resize(EVENT_COVER_MAX_DIMENSION, EVENT_COVER_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: EVENT_COVER_WEBP_QUALITY })
      .toBuffer();
    return { buffer, extension: "webp" };
  }

  private async decodeImage(
    file: UploadedFileLike,
    allowedMimeTypes: readonly string[],
    maxBytes: number,
  ): Promise<sharp.Sharp> {
    if (file.size > maxBytes) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        `Image must be at most ${maxBytes / (1024 * 1024)} MB`,
      );
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "Image must be a JPEG, PNG, or WebP file",
      );
    }

    const image = sharp(file.buffer, { failOn: "error" });

    let format: string | undefined;
    try {
      const metadata = await image.metadata();
      format = metadata.format;
    } catch {
      throw new AppError(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "File is not a valid image");
    }

    if (!format || !(ALLOWED_SHARP_FORMATS as readonly string[]).includes(format)) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "File is not a valid JPEG, PNG, or WebP image",
      );
    }

    return image;
  }
}
