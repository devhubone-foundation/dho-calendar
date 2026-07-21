-- CreateEnum
CREATE TYPE "EventRecurrenceFrequency" AS ENUM ('NONE', 'WEEKLY');

-- CreateEnum
CREATE TYPE "EventRecurrenceEndType" AS ENUM ('COUNT', 'UNTIL');

-- CreateTable
CREATE TABLE "event_series" (
    "id" TEXT NOT NULL,
    "titleBg" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionBg" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL,
    "location" TEXT NOT NULL,
    "coverImagePath" TEXT,
    "frequency" "EventRecurrenceFrequency" NOT NULL DEFAULT 'NONE',
    "byWeekdays" "Weekday"[],
    "recurrenceEndType" "EventRecurrenceEndType",
    "recurrenceCount" INTEGER,
    "recurrenceUntil" DATE,
    "endsBeforeDate" DATE,
    "splitFromSeriesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_recurrence_exceptions" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "occurrenceDate" DATE NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "titleBg" TEXT,
    "titleEn" TEXT,
    "descriptionBg" TEXT,
    "descriptionEn" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "isAllDay" BOOLEAN,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_recurrence_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_series_startAt_idx" ON "event_series"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_recurrence_exceptions_seriesId_occurrenceDate_key" ON "event_recurrence_exceptions"("seriesId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "event_recurrence_exceptions" ADD CONSTRAINT "event_recurrence_exceptions_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "event_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
