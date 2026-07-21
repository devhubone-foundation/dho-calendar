import argon2 from "argon2";
import { PrismaClient } from "@dho/database";
import type { UserRole } from "@dho/contracts";

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.attendanceException.deleteMany();
  await prisma.memberWeeklySchedule.deleteMany();
  await prisma.officeScheduleException.deleteMany();
  await prisma.officeScheduleDefault.deleteMany();
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

/** Seeds the standard Mon/Wed/Fri 12:00-20:00 office defaults, effective from
 * a fixed epoch, so office-schedule/attendance tests have a real baseline to
 * resolve against without duplicating the production seed script. */
export async function seedOfficeDefaults(prisma: PrismaClient): Promise<void> {
  const effectiveFrom = new Date("2000-01-01T00:00:00.000Z");
  await prisma.officeScheduleDefault.createMany({
    data: [
      { weekday: "MONDAY", isOpen: true, startTime: "12:00", endTime: "20:00", effectiveFrom },
      { weekday: "TUESDAY", isOpen: false, startTime: null, endTime: null, effectiveFrom },
      { weekday: "WEDNESDAY", isOpen: true, startTime: "12:00", endTime: "20:00", effectiveFrom },
      { weekday: "THURSDAY", isOpen: false, startTime: null, endTime: null, effectiveFrom },
      { weekday: "FRIDAY", isOpen: true, startTime: "12:00", endTime: "20:00", effectiveFrom },
      { weekday: "SATURDAY", isOpen: false, startTime: null, endTime: null, effectiveFrom },
      { weekday: "SUNDAY", isOpen: false, startTime: null, endTime: null, effectiveFrom },
    ],
  });
}
