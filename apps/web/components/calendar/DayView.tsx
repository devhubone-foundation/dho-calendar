"use client";

import type { EventOccurrence, PublicCalendarDay } from "@dho/contracts";

import { groupOccurrencesByDate } from "../../lib/calendar-grid";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";
import { EventCard } from "./EventCard";
import { PublicDayAttendance } from "./PublicDayAttendance";

export interface DayViewProps {
  dateKey: string;
  occurrences: EventOccurrence[];
  /** Full public day data — when provided, shows the Hub open/closed state
   * and who's confirmed/maybe attending above the event list, matching the
   * day-details modal (Issue #12). */
  day?: PublicCalendarDay;
  locale: Locale;
}

/** Detailed chronological view for one selected date (PRODUCT_BLUEPRINT.md §15.3). */
export function DayView({ dateKey, occurrences, day, locale }: DayViewProps) {
  const dictionary = useDictionary();
  const dayOccurrences = (groupOccurrencesByDate(occurrences, [dateKey]).get(dateKey) ?? [])
    .slice()
    .sort((a, b) => (a.startAt < b.startAt ? -1 : 1));

  return (
    <div className="dho-cal-day-list">
      {day ? (
        <PublicDayAttendance
          office={day.office}
          confirmedAttendees={day.confirmedAttendees}
          uncertainAttendees={day.uncertainAttendees}
          locale={locale}
        />
      ) : null}

      {dayOccurrences.length === 0 ? (
        <p className="dho-cal-empty">{dictionary.calendar.noEventsOnDay}</p>
      ) : (
        dayOccurrences.map((occurrence) => (
          <EventCard
            key={`${occurrence.seriesId}-${occurrence.occurrenceDate}`}
            occurrence={occurrence}
            locale={locale}
            variant="detailed"
          />
        ))
      )}
    </div>
  );
}
