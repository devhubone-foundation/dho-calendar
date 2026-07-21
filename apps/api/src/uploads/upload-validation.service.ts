import { HttpStatus, Injectable } from "@nestjs/common";
import { PROFILE_PICTURE_ALLOWED_MIME_TYPES, PROFILE_PICTURE_MAX_BYTES } from "@dho/contracts";
import sharp from "sharp";

import { AppError } from "../common/errors/app-error";

const PROFILE_PICTURE_MAX_DIMENSION = 512;
const PROFILE_PICTURE_WEBP_QUALITY = 82;
const ALLOWED_SHARP_FORMATS = ["jpeg", "png", "webp"] as const;

export interface UploadedFileLike {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

export interface NormalizedProfilePicture {
  buffer: Buffer;
  extension: "webp";
}

/**
 * Validates and normalizes a profile-picture upload per ARCHITECTURE.md §13:
 * JPEG/PNG/WebP, max 5 MB. Every accepted file is re-encoded through sharp,
 * which doubles as the "content" check (sharp rejects anything that doesn't
 * decode as a real image, not just a spoofed MIME header), strips EXIF
 * metadata, and normalizes output to a fixed-size WebP so stored filenames
 * never depend on client-supplied extensions.
 */
@Injectable()
export class UploadValidationService {
  async validateAndNormalizeProfilePicture(file: UploadedFileLike): Promise<NormalizedProfilePicture> {
    if (file.size > PROFILE_PICTURE_MAX_BYTES) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        `Image must be at most ${PROFILE_PICTURE_MAX_BYTES / (1024 * 1024)} MB`,
      );
    }

    if (!(PROFILE_PICTURE_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
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
}
