import argon2 from "argon2";

import { PrismaClient } from "../generated/client/index.js";

const prisma = new PrismaClient();

// Local-development-only credentials. Never reused for a deployed environment.
const ADMIN_EMAIL = "admin@devhubone.local";
const ADMIN_PASSWORD = "DevHubOne-Admin-2026!";
const MEMBER_EMAIL = "member@devhubone.local";
const MEMBER_TEMP_PASSWORD = "TempPass-2026!";

async function main() {
  const adminPasswordHash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });
  const memberPasswordHash = await argon2.hash(MEMBER_TEMP_PASSWORD, { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { email: MEMBER_EMAIL },
    update: {},
    create: {
      email: MEMBER_EMAIL,
      passwordHash: memberPasswordHash,
      role: "MEMBER",
      isActive: true,
      mustChangePassword: true,
    },
  });

  console.log("Seed complete. Local-development-only credentials:");
  console.log(`  Admin:  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(
    `  Member: ${MEMBER_EMAIL} / ${MEMBER_TEMP_PASSWORD} (mustChangePassword = true)`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
