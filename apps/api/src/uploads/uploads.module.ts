import { Module } from "@nestjs/common";

import { EventCoverStorageService } from "./event-cover-storage.service";
import { ProfilePictureStorageService } from "./profile-picture-storage.service";
import { UploadValidationService } from "./upload-validation.service";
import { UploadsController } from "./uploads.controller";

@Module({
  controllers: [UploadsController],
  providers: [UploadValidationService, ProfilePictureStorageService, EventCoverStorageService],
  exports: [UploadValidationService, ProfilePictureStorageService, EventCoverStorageService],
})
export class UploadsModule {}
