"use client";

import { cn } from "@dho/ui";
import type { EventOccurrence } from "@dho/contracts";

import { getWeekDates, groupOccurrencesByDate, todayKey } from "../../lib/calendar-grid";
import { formatWeekdayAndDay } from "../../lib/event-format";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";
import { activatableProps } from "./activatable";
import { EventCard } from "./EventCard";

export interface WeekViewProps {
  /** Any date within the week to display. */
  anchorDateKey: string;
  occurrences: EventOccurrence[];
  locale: Locale;
  onSelectDate: (dateKey: string) => void;
}

/** One column per weekday (Monday-first), each listing that day's events in
 * chronological order with their time range — satisfies the "time-based
 * detail for events and their durations" requirement (PRODUCT_BLUEPRINT.md
 * §15.2) without a full pixel-positioned hour grid. */
export function WeekView({ anchorDateKey, occurrences, locale, onSelectDate }: WeekViewProps) {
  const dictionary = useDictionary();
  const dates = getWeekDates(anchorDateKey);
  const grouped = groupOccurrencesByDate(occurrences, dates);
  const today = todayKey();

  return (
    <div className="dho-cal-week-grid" role="grid" aria-label={dictionary.calendar.viewWeek}>
      {dates.map((dateKey) => {
        const dayOccurrences = (grouped.get(dateKey) ?? [])
          .slice()
          .sort((a, b) => (a.startAt < b.startAt ? -1 : 1));

        return (
          <div
            key={dateKey}
            className={cn("dho-cal-week-column", dateKey === today && "dho-cal-week-column--today")}
          >
            <div className="dho-cal-week-column-header" {...activatableProps(() => onSelectDate(dateKey))}>
              {formatWeekdayAndDay(dateKey, locale)}
            </div>
            <div className="dho-cal-week-column-events">
              {dayOccurrences.length === 0 ? (
                <p className="dho-cal-empty">{dictionary.calendar.noEventsOnDay}</p>
              ) : (
                dayOccurrences.map((occurrence) => (
                  <EventCard
                    key={`${occurrence.seriesId}-${occurrence.occurrenceDate}-${dateKey}`}
                    occurrence={occurrence}
                    locale={locale}
                    variant="compact"
                    onActivate={() => onSelectDate(dateKey)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
