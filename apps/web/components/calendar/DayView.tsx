"use client";

import type { EventOccurrence } from "@dho/contracts";

import { groupOccurrencesByDate } from "../../lib/calendar-grid";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";
import { EventCard } from "./EventCard";

export interface DayViewProps {
  dateKey: string;
  occurrences: EventOccurrence[];
  locale: Locale;
}

/** Detailed chronological list for one selected date (PRODUCT_BLUEPRINT.md §15.3). */
export function DayView({ dateKey, occurrences, locale }: DayViewProps) {
  const dictionary = useDictionary();
  const dayOccurrences = (groupOccurrencesByDate(occurrences, [dateKey]).get(dateKey) ?? [])
    .slice()
    .sort((a, b) => (a.startAt < b.startAt ? -1 : 1));

  if (dayOccurrences.length === 0) {
    return <p className="dho-cal-empty">{dictionary.calendar.noEventsOnDay}</p>;
  }

  return (
    <div className="dho-cal-day-list">
      {dayOccurrences.map((occurrence) => (
        <EventCard
          key={`${occurrence.seriesId}-${occurrence.occurrenceDate}`}
          occurrence={occurrence}
          locale={locale}
          variant="detailed"
        />
      ))}
    </div>
  );
}
