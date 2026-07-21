import { stat } from "node:fs/promises";
import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import type { Response } from "express";

import { Public } from "../common/decorators/public.decorator";
import { EventCoverStorageService } from "./event-cover-storage.service";
import { ProfilePictureStorageService } from "./profile-picture-storage.service";

async function sendStoredFile(resolved: string | null, response: Response): Promise<void> {
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

@Controller("uploads")
export class UploadsController {
  constructor(
    private readonly profilePictureStorage: ProfilePictureStorageService,
    private readonly eventCoverStorage: EventCoverStorageService,
  ) {}

  @Public()
  @Get("profiles/:filename")
  async getProfilePicture(@Param("filename") filename: string, @Res() response: Response): Promise<void> {
    await sendStoredFile(this.profilePictureStorage.resolveFilename(filename), response);
  }

  @Public()
  @Get("events/:filename")
  async getEventCover(@Param("filename") filename: string, @Res() response: Response): Promise<void> {
    await sendStoredFile(this.eventCoverStorage.resolveFilename(filename), response);
  }
}
