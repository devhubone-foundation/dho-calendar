import { Injectable, NotFoundException } from "@nestjs/common";
import type { MemberSummary, ProfilePictureUploadResponse, SelfProfileUpdateRequest } from "@dho/contracts";

import { AuditService } from "../audit/audit.service";
import { throwIfUniqueEmailViolation, toMemberSummary } from "../common/member-summary.util";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilePictureStorageService } from "../uploads/profile-picture-storage.service";
import { UploadValidationService, type UploadedFileLike } from "../uploads/upload-validation.service";

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadValidation: UploadValidationService,
    private readonly storage: ProfilePictureStorageService,
    private readonly audit: AuditService,
  ) {}

  async getOwnProfile(userId: string): Promise<MemberSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user || !user.profile) {
      throw new NotFoundException("Profile not found");
    }
    return toMemberSummary(user, user.profile);
  }

  async updateOwnProfile(userId: string, data: SelfProfileUpdateRequest): Promise<MemberSummary> {
    try {
      const [user, profile] = await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: userId }, data: { email: data.email } }),
        this.prisma.memberProfile.update({
          where: { userId },
          data: {
            fullName: data.fullName,
            qualificationBg: data.qualificationBg,
            qualificationEn: data.qualificationEn,
          },
        }),
      ]);
      await this.audit.record({
        actorId: userId,
        action: "profile.updated",
        targetType: "User",
        targetId: userId,
        metadata: { fullName: data.fullName, email: data.email },
      });
      return toMemberSummary(user, profile);
    } catch (error) {
      throwIfUniqueEmailViolation(error);
      throw error;
    }
  }

  async replaceOwnProfilePicture(
    userId: string,
    file: UploadedFileLike,
  ): Promise<ProfilePictureUploadResponse> {
    const existingProfile = await this.prisma.memberProfile.findUnique({ where: { userId } });
    if (!existingProfile) {
      throw new NotFoundException("Profile not found");
    }
    const previousPath = existingProfile.profileImagePath;

    const normalized = await this.uploadValidation.validateAndNormalizeProfilePicture(file);
    const newRelativePath = await this.storage.save(normalized.buffer, normalized.extension);

    let updatedProfile;
    try {
      updatedProfile = await this.prisma.memberProfile.update({
        where: { userId },
        data: { profileImagePath: newRelativePath },
      });
    } catch (error) {
      // The DB update failed: clean up the orphaned new file and leave the
      // previous (still-valid) picture untouched.
      await this.storage.removeIfExists(newRelativePath);
      throw error;
    }

    // The DB update succeeded: only now is it safe to remove the old file
    // (ARCHITECTURE.md §13 — replace only after the new file + DB succeed).
    if (previousPath && previousPath !== newRelativePath) {
      await this.storage.removeIfExists(previousPath);
    }

    await this.audit.record({
      actorId: userId,
      action: "profile.picture_replaced",
      targetType: "User",
      targetId: userId,
    });

    return { profileImagePath: updatedProfile.profileImagePath as string };
  }
}
