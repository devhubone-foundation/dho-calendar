import { HttpStatus } from "@nestjs/common";
import type { MemberSummary } from "@dho/contracts";
import { Prisma } from "@dho/database";

import { AppError } from "./errors/app-error";

export function toMemberSummary(
  user: { id: string; email: string; role: string; isActive: boolean; mustChangePassword: boolean },
  profile: {
    fullName: string;
    qualificationBg: string;
    qualificationEn: string;
    profileImagePath: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
): MemberSummary {
  return {
    id: user.id,
    email: user.email,
    role: user.role as MemberSummary["role"],
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    fullName: profile.fullName,
    qualificationBg: profile.qualificationBg,
    qualificationEn: profile.qualificationEn,
    profileImagePath: profile.profileImagePath,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/** Throws a clean 409 CONFLICT for a duplicate-email violation; otherwise returns normally. */
export function throwIfUniqueEmailViolation(error: unknown): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError(HttpStatus.CONFLICT, "CONFLICT", "This email address is already in use", {
      email: ["This email address is already in use"],
    });
  }
}
