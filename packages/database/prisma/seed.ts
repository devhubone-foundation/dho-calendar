import argon2 from "argon2";

import { PrismaClient, type UserRole } from "../generated/client/index.js";

const prisma = new PrismaClient();

// Local-development-only credentials. Never reused for a deployed environment.
const ADMIN_EMAIL = "admin@devhubone.local";
const ADMIN_PASSWORD = "DevHubOne-Admin-2026!";
const MEMBER_EMAIL = "member@devhubone.local";
const MEMBER_TEMP_PASSWORD = "TempPass-2026!";
const SECOND_MEMBER_EMAIL = "kalina@devhubone.local";
const SECOND_MEMBER_PASSWORD = "Kalina-Dev-2026!";
const INACTIVE_MEMBER_EMAIL = "former-member@devhubone.local";
const INACTIVE_MEMBER_PASSWORD = "Former-Member-2026!";

interface SeedAccount {
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  profile: {
    fullName: string;
    qualificationBg: string;
    qualificationEn: string;
  };
}

const ACCOUNTS: SeedAccount[] = [
  {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: "ADMIN",
    isActive: true,
    mustChangePassword: false,
    profile: {
      fullName: "Admin Administrov",
      qualificationBg: "Технически съосновател",
      qualificationEn: "Technical co-founder",
    },
  },
  {
    email: MEMBER_EMAIL,
    password: MEMBER_TEMP_PASSWORD,
    role: "MEMBER",
    isActive: true,
    mustChangePassword: true,
    profile: {
      fullName: "Newly Onboarded",
      qualificationBg: "Програмист",
      qualificationEn: "Programmer",
    },
  },
  {
    email: SECOND_MEMBER_EMAIL,
    password: SECOND_MEMBER_PASSWORD,
    role: "MEMBER",
    isActive: true,
    mustChangePassword: false,
    profile: {
      fullName: "Kalina Petrova",
      qualificationBg: "3D Художник",
      qualificationEn: "3D Artist",
    },
  },
  {
    email: INACTIVE_MEMBER_EMAIL,
    password: INACTIVE_MEMBER_PASSWORD,
    role: "MEMBER",
    isActive: false,
    mustChangePassword: false,
    profile: {
      fullName: "Former Member",
      qualificationBg: "Геймдизайнер",
      qualificationEn: "Game Designer",
    },
  },
];

async function main() {
  for (const account of ACCOUNTS) {
    const passwordHash = await argon2.hash(account.password, { type: argon2.argon2id });

    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        email: account.email,
        passwordHash,
        role: account.role,
        isActive: account.isActive,
        mustChangePassword: account.mustChangePassword,
      },
    });

    await prisma.memberProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        fullName: account.profile.fullName,
        qualificationBg: account.profile.qualificationBg,
        qualificationEn: account.profile.qualificationEn,
      },
    });
  }

  console.log("Seed complete. Local-development-only credentials:");
  for (const account of ACCOUNTS) {
    console.log(
      `  ${account.role.padEnd(6)} ${account.isActive ? "active  " : "inactive"} ${account.email} / ${account.password}${account.mustChangePassword ? " (mustChangePassword = true)" : ""}`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
