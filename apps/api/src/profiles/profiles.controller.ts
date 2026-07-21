import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  type AuthenticatedUser,
  type MemberSummary,
  type ProfilePictureUploadResponse,
  type SelfProfileUpdateRequest,
  selfProfileUpdateRequestSchema,
} from "@dho/contracts";
import { memoryStorage } from "multer";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ProfilesService } from "./profiles.service";

// A generous hard ceiling on request memory usage only. The authoritative
// 5 MB limit (ARCHITECTURE.md §13) is enforced with a clean error message by
// UploadValidationService; this just bounds abusive uploads before that.
const MULTER_MEMORY_SAFETY_LIMIT_BYTES = 10 * 1024 * 1024;

@Controller("me")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get("profile")
  getOwnProfile(@CurrentUser() user: AuthenticatedUser): Promise<MemberSummary> {
    return this.profilesService.getOwnProfile(user.id);
  }

  @Patch("profile")
  updateOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(selfProfileUpdateRequestSchema)) body: SelfProfileUpdateRequest,
  ): Promise<MemberSummary> {
    return this.profilesService.updateOwnProfile(user.id, body);
  }

  @Post("profile/picture")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_MEMORY_SAFETY_LIMIT_BYTES },
    }),
  )
  replaceOwnProfilePicture(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ProfilePictureUploadResponse> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return this.profilesService.replaceOwnProfilePicture(user.id, {
      buffer: file.buffer,
      size: file.size,
      mimetype: file.mimetype,
    });
  }
}
