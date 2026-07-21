import { stat } from "node:fs/promises";
import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import type { Response } from "express";

import { Public } from "../common/decorators/public.decorator";
import { ProfilePictureStorageService } from "./profile-picture-storage.service";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly storage: ProfilePictureStorageService) {}

  @Public()
  @Get("profiles/:filename")
  async getProfilePicture(@Param("filename") filename: string, @Res() response: Response): Promise<void> {
    const resolved = this.storage.resolveFilename(filename);
    if (!resolved) {
      throw new NotFoundException();
    }

    try {
      const stats = await stat(resolved);
      if (!stats.isFile()) {
        throw new NotFoundException();
      }
    } catch {
      throw new NotFoundException();
    }

    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    response.sendFile(resolved);
  }
}
