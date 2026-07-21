import { Module } from "@nestjs/common";

import { ProfilePictureStorageService } from "./profile-picture-storage.service";
import { UploadValidationService } from "./upload-validation.service";
import { UploadsController } from "./uploads.controller";

@Module({
  controllers: [UploadsController],
  providers: [UploadValidationService, ProfilePictureStorageService],
  exports: [UploadValidationService, ProfilePictureStorageService],
})
export class UploadsModule {}
