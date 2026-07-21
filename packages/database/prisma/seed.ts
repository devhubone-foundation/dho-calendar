import argon2 from "argon2";

import {
  type AttendanceStatus,
  PrismaClient,
  type UserRole,
  type Weekday,
} from "../generated/client/index.js";

const prisma = new PrismaClient();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(date: string, amount: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

/** Next date on or after `date` (inclusive) that falls on `targetJsDay`
 * (JS `Date#getUTCDay()` numbering: Sunday=0 ... Saturday=6). */
function nextWeekdayOnOrAfter(date: string, targetJsDay: number): string {
  let cursor = date;
  while (new Date(`${cursor}T00:00:00.000Z`).getUTCDay() !== targetJsDay) {
    cursor = addDaysIso(cursor, 1);
  }
  return cursor;
}

function toDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

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

// Issue #3: seeded office defaults (PRODUCT_BLUEPRINT.md §9.2). effectiveFrom
// is a fixed epoch well before any real usage so every real-world date
// resolves to these unless an admin has since saved a newer version.
const OFFICE_DEFAULT_EFFECTIVE_FROM = "2000-01-01";

interface OfficeDefaultSeed {
  weekday: Weekday;
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
}

const OFFICE_DEFAULTS: OfficeDefaultSeed[] = [
  { weekday: "MONDAY", isOpen: true, startTime: "12:00", endTime: "20:00" },
  { weekday: "TUESDAY", isOpen: false, startTime: null, endTime: null },
  { weekday: "WEDNESDAY", isOpen: true, startTime: "12:00", endTime: "20:00" },
  { weekday: "THURSDAY", isOpen: false, startTime: null, endTime: null },
  { weekday: "FRIDAY", isOpen: true, startTime: "12:00", endTime: "20:00" },
  { weekday: "SATURDAY", isOpen: false, startTime: null, endTime: null },
  { weekday: "SUNDAY", isOpen: false, startTime: null, endTime: null },
];

async function upsertAttendanceException(
  userId: string,
  date: string,
  status: AttendanceStatus,
  startTime: string | null,
  endTime: string | null,
): Promise<void> {
  await prisma.attendanceException.upsert({
    where: { userId_date: { userId, date: toDateOnly(date) } },
    update: { status, startTime, endTime },
    create: { userId, date: toDateOnly(date), status, startTime, endTime },
  });
}

async function upsertOfficeException(
  date: string,
  isOpen: boolean,
  startTime: string | null,
  endTime: string | null,
): Promise<void> {
  await prisma.officeScheduleException.upsert({
    where: { date: toDateOnly(date) },
    update: { isOpen, startTime, endTime },
    create: { date: toDateOnly(date), isOpen, startTime, endTime },
  });
}

async function main() {
  const userIdByEmail = new Map<string, string>();

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
    userIdByEmail.set(account.email, user.id);

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

  const adminId = userIdByEmail.get(ADMIN_EMAIL) as string;
  const memberId = userIdByEmail.get(MEMBER_EMAIL) as string;
  const kalinaId = userIdByEmail.get(SECOND_MEMBER_EMAIL) as string;

  // Office schedule defaults: only seed once, so a subsequent seed run never
  // clobbers a locally-tested admin edit (`prisma:seed` is meant to be re-run
  // safely against an existing dev database).
  if ((await prisma.officeScheduleDefault.count()) === 0) {
    await prisma.officeScheduleDefault.createMany({
      data: OFFICE_DEFAULTS.map((day) => ({
        ...day,
        effectiveFrom: toDateOnly(OFFICE_DEFAULT_EFFECTIVE_FROM),
      })),
    });
  }

  // Kalina has customized her own Wednesday (docs/TESTING_STRATEGY.md "a
  // member with a custom weekly schedule"): 14:00-18:00 instead of the
  // office default's 12:00-20:00. Monday/Friday stay inherited.
  const existingKalinaWednesday = await prisma.memberWeeklySchedule.findFirst({
    where: { userId: kalinaId, weekday: "WEDNESDAY" },
  });
  if (!existingKalinaWednesday) {
    await prisma.memberWeeklySchedule.create({
      data: {
        userId: kalinaId,
        weekday: "WEDNESDAY",
        attends: true,
        startTime: "14:00",
        endTime: "18:00",
        effectiveFrom: toDateOnly("2020-01-01"),
      },
    });
  }

  // Demo dates are always computed relative to today so the admin-warning
  // scenario stays inside the default 14-day look-ahead however long ago
  // this seed was first run.
  const today = todayIso();
  const confirmedMonday = nextWeekdayOnOrAfter(today, 1);
  const changedHoursMonday = addDaysIso(confirmedMonday, 7);
  const notSureOnlyFriday = nextWeekdayOnOrAfter(today, 5);
  const closedWednesday = addDaysIso(nextWeekdayOnOrAfter(today, 3), 7);

  // Confirmed attendance exception (explicit override, different hours than
  // the 12:00-20:00 default, so it's visibly a real saved exception).
  await upsertAttendanceException(memberId, confirmedMonday, "ATTENDING", "13:00", "19:00");

  // A working Friday with zero confirmed attendees: everyone active is
  // NOT_ATTENDING except Kalina, who is NOT_SURE — demonstrates both the
  // "no confirmed attendee" warning and the "Not sure alone still warns" rule.
  await upsertAttendanceException(adminId, notSureOnlyFriday, "NOT_ATTENDING", null, null);
  await upsertAttendanceException(memberId, notSureOnlyFriday, "NOT_ATTENDING", null, null);
  await upsertAttendanceException(kalinaId, notSureOnlyFriday, "NOT_SURE", "12:00", "16:00");

  // A date-specific office-hours change and a one-off closure, each isolated
  // to a single date without touching the weekly defaults.
  await upsertOfficeException(changedHoursMonday, true, "10:00", "18:00");
  await upsertOfficeException(closedWednesday, false, null, null);

  console.log("Seed complete. Local-development-only credentials:");
  for (const account of ACCOUNTS) {
    console.log(
      `  ${account.role.padEnd(6)} ${account.isActive ? "active  " : "inactive"} ${account.email} / ${account.password}${account.mustChangePassword ? " (mustChangePassword = true)" : ""}`,
    );
  }
  console.log("Office schedule / attendance demo dates:");
  console.log(`  Confirmed ATTENDING exception (member@...): ${confirmedMonday}`);
  console.log(`  No-confirmed-attendee warning (Not sure only): ${notSureOnlyFriday}`);
  console.log(`  Changed office hours (10:00-18:00): ${changedHoursMonday}`);
  console.log(`  Closed date: ${closedWednesday}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
