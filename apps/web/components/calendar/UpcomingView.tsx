"use client";

import type { EventOccurrence } from "@dho/contracts";

import { formatEventDate } from "../../lib/event-format";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";
import { EventCard } from "./EventCard";

export interface UpcomingViewProps {
  occurrences: EventOccurrence[];
  locale: Locale;
}

/** Chronological, date-grouped list prioritizing future events — usable on
 * narrow widths (PRODUCT_BLUEPRINT.md §15.4). */
export function UpcomingView({ occurrences, locale }: UpcomingViewProps) {
  const dictionary = useDictionary();
  const sorted = occurrences.slice().sort((a, b) => (a.startAt < b.startAt ? -1 : 1));

  if (sorted.length === 0) {
    return <p className="dho-cal-empty">{dictionary.calendar.noEventsUpcoming}</p>;
  }

  const groups: { dateKey: string; items: EventOccurrence[] }[] = [];
  for (const occurrence of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.dateKey === occurrence.occurrenceDate) {
      last.items.push(occurrence);
    } else {
      groups.push({ dateKey: occurrence.occurrenceDate, items: [occurrence] });
    }
  }

  return (
    <div className="dho-cal-upcoming-list">
      {groups.map((group) => (
        <section key={group.dateKey} className="dho-cal-upcoming-group">
          <h3 className="dho-cal-upcoming-date">{formatEventDate(group.dateKey, locale)}</h3>
          {group.items.map((occurrence) => (
            <EventCard
              key={`${occurrence.seriesId}-${occurrence.occurrenceDate}`}
              occurrence={occurrence}
              locale={locale}
              variant="detailed"
            />
          ))}
        </section>
      ))}
    </div>
  );
}
