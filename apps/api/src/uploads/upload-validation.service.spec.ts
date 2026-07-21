import sharp from "sharp";

import { AppError } from "../common/errors/app-error";
import { UploadValidationService } from "./upload-validation.service";

async function makeImage(format: "png" | "jpeg" | "webp", size = 20): Promise<Buffer> {
  const image = sharp({
    create: { width: size, height: size, channels: 3, background: { r: 200, g: 50, b: 50 } },
  });
  if (format === "png") return image.png().toBuffer();
  if (format === "jpeg") return image.jpeg().toBuffer();
  return image.webp().toBuffer();
}

describe("UploadValidationService", () => {
  const service = new UploadValidationService();

  it("accepts a valid PNG and normalizes it to WebP", async () => {
    const buffer = await makeImage("png");
    const result = await service.validateAndNormalizeProfilePicture({
      buffer,
      size: buffer.length,
      mimetype: "image/png",
    });
    expect(result.extension).toBe("webp");

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("webp");
  });

  it("accepts a valid JPEG and a valid WebP", async () => {
    for (const format of ["jpeg", "webp"] as const) {
      const buffer = await makeImage(format);
      const result = await service.validateAndNormalizeProfilePicture({
        buffer,
        size: buffer.length,
        mimetype: `image/${format}`,
      });
      expect(result.extension).toBe("webp");
    }
  });

  it("downscales an oversized image to the max dimension", async () => {
    const buffer = await makeImage("png", 2000);
    const result = await service.validateAndNormalizeProfilePicture({
      buffer,
      size: buffer.length,
      mimetype: "image/png",
    });
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.height).toBeLessThanOrEqual(512);
  });

  it("rejects a file over the size limit", async () => {
    const buffer = await makeImage("png");
    await expect(
      service.validateAndNormalizeProfilePicture({
        buffer,
        size: 6 * 1024 * 1024,
        mimetype: "image/png",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects a disallowed MIME type even if the header claims otherwise", async () => {
    const buffer = await makeImage("png");
    await expect(
      service.validateAndNormalizeProfilePicture({
        buffer,
        size: buffer.length,
        mimetype: "image/gif",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects a non-image file that spoofs an allowed MIME type", async () => {
    const buffer = Buffer.from("this is not an image, just plain text pretending to be one");
    await expect(
      service.validateAndNormalizeProfilePicture({
        buffer,
        size: buffer.length,
        mimetype: "image/png",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
