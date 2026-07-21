-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ATTENDING', 'NOT_SURE', 'NOT_ATTENDING');

-- CreateTable
CREATE TABLE "office_schedule_defaults" (
    "id" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "isOpen" BOOLEAN NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "office_schedule_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_schedule_exceptions" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isOpen" BOOLEAN NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "office_schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_weekly_schedules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "attends" BOOLEAN NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_weekly_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_exceptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "office_schedule_defaults_weekday_effectiveFrom_idx" ON "office_schedule_defaults"("weekday", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "office_schedule_exceptions_date_key" ON "office_schedule_exceptions"("date");

-- CreateIndex
CREATE INDEX "member_weekly_schedules_userId_weekday_effectiveFrom_idx" ON "member_weekly_schedules"("userId", "weekday", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_exceptions_userId_date_key" ON "attendance_exceptions"("userId", "date");

-- AddForeignKey
ALTER TABLE "member_weekly_schedules" ADD CONSTRAINT "member_weekly_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
