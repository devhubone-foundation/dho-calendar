"use client";

import { cn } from "@dho/ui";
import type { EventOccurrence } from "@dho/contracts";

import { getMonthGridDates, groupOccurrencesByDate, todayKey } from "../../lib/calendar-grid";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";
import { activatableProps } from "./activatable";
import { EventCard } from "./EventCard";

export interface MonthViewProps {
  year: number;
  /** 0-indexed, matching `Date#getMonth()`. */
  month: number;
  occurrences: EventOccurrence[];
  /** Optional light augmentation: dates confirmed open by #3's office
   * resolver (read-only consumption, no office/attendance logic here). */
  officeOpenDates?: Set<string>;
  locale: Locale;
  onSelectDate: (dateKey: string) => void;
}

const MAX_VISIBLE_PER_CELL = 3;

/** Compact month overview. Events are the visually prominent content; the
 * office open/closed dot is a secondary, read-only indicator. */
export function MonthView({ year, month, occurrences, officeOpenDates, locale, onSelectDate }: MonthViewProps) {
  const dictionary = useDictionary();
  const dates = getMonthGridDates(year, month);
  const grouped = groupOccurrencesByDate(occurrences, dates);
  const today = todayKey();

  return (
    <div className="dho-cal-month-grid" role="grid" aria-label={dictionary.calendar.viewMonth}>
      {dates.map((dateKey) => {
        const dayOccurrences = grouped.get(dateKey) ?? [];
        const isCurrentMonth = new Date(`${dateKey}T00:00:00.000Z`).getUTCMonth() === month;
        const isToday = dateKey === today;
        const visible = dayOccurrences.slice(0, MAX_VISIBLE_PER_CELL);
        const overflow = dayOccurrences.length - visible.length;
        const officeIsOpen = officeOpenDates?.has(dateKey);

        return (
          <div
            key={dateKey}
            className={cn(
              "dho-cal-month-cell",
              !isCurrentMonth && "dho-cal-month-cell--outside",
              isToday && "dho-cal-month-cell--today",
            )}
            {...activatableProps(() => onSelectDate(dateKey))}
          >
            <div className="dho-cal-month-cell-header">
              <span className="dho-cal-month-cell-date">{Number(dateKey.slice(8, 10))}</span>
              {officeOpenDates ? (
                <span
                  className={cn(
                    "dho-cal-office-dot",
                    officeIsOpen ? "dho-cal-office-dot--open" : "dho-cal-office-dot--closed",
                  )}
                  title={officeIsOpen ? dictionary.calendar.officeOpen : dictionary.calendar.officeClosed}
                  aria-hidden="true"
                />
              ) : null}
            </div>
            <div className="dho-cal-month-cell-events">
              {visible.map((occurrence) => (
                <EventCard
                  key={`${occurrence.seriesId}-${occurrence.occurrenceDate}`}
                  occurrence={occurrence}
                  locale={locale}
                  variant="compact"
                />
              ))}
              {overflow > 0 ? <span className="dho-cal-month-cell-overflow">+{overflow}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
