-- CreateTable
CREATE TABLE "member_weekly_schedule_slots" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "member_weekly_schedule_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_exception_slots" (
    "id" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "attendance_exception_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_weekly_schedule_slots_scheduleId_idx" ON "member_weekly_schedule_slots"("scheduleId");

-- CreateIndex
CREATE INDEX "attendance_exception_slots_exceptionId_idx" ON "attendance_exception_slots"("exceptionId");

-- AddForeignKey
ALTER TABLE "member_weekly_schedule_slots" ADD CONSTRAINT "member_weekly_schedule_slots_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "member_weekly_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exception_slots" ADD CONSTRAINT "attendance_exception_slots_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "attendance_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: copy each existing single interval into one slot row so no
-- history is lost before the old scalar columns are dropped below.
INSERT INTO "member_weekly_schedule_slots" ("id", "scheduleId", "startTime", "endTime", "sortOrder")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "id", "startTime", "endTime", 0
FROM "member_weekly_schedules"
WHERE "attends" = true AND "startTime" IS NOT NULL AND "endTime" IS NOT NULL;

INSERT INTO "attendance_exception_slots" ("id", "exceptionId", "startTime", "endTime", "sortOrder")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "id", "startTime", "endTime", 0
FROM "attendance_exceptions"
WHERE "status" IN ('ATTENDING', 'NOT_SURE') AND "startTime" IS NOT NULL AND "endTime" IS NOT NULL;

-- AlterTable
ALTER TABLE "member_weekly_schedules" DROP COLUMN "startTime",
DROP COLUMN "endTime";

-- AlterTable
ALTER TABLE "attendance_exceptions" DROP COLUMN "startTime",
DROP COLUMN "endTime";
