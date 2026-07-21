import argon2 from "argon2";
import { PrismaClient } from "@dho/database";
import type { UserRole } from "@dho/contracts";

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.memberProfile.deleteMany();
  await prisma.user.deleteMany();
}

interface CreateTestUserOptions {
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  mustChangePassword?: boolean;
  /** Set to false to create a bare User row with no MemberProfile, e.g. to
   * exercise a not-found path. Defaults to true since every real account
   * created by this app now has a profile. */
  withProfile?: boolean;
  fullName?: string;
  qualificationBg?: string;
  qualificationEn?: string;
}

export async function createTestUser(
  prisma: PrismaClient,
  options: CreateTestUserOptions = {},
): Promise<{ id: string; email: string; password: string }> {
  const password = options.password ?? "correct-horse-battery-staple";
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const email =
    options.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: options.role ?? "MEMBER",
      isActive: options.isActive ?? true,
      mustChangePassword: options.mustChangePassword ?? false,
      ...(options.withProfile === false
        ? {}
        : {
            profile: {
              create: {
                fullName: options.fullName ?? "Test Member",
                qualificationBg: options.qualificationBg ?? "Тестова роля",
                qualificationEn: options.qualificationEn ?? "Test role",
              },
            },
          }),
    },
  });

  return { id: user.id, email: user.email, password };
}
