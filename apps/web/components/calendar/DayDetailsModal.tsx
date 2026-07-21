"use client";

import { Modal } from "@dho/ui";
import type { EventOccurrence } from "@dho/contracts";

import { groupOccurrencesByDate } from "../../lib/calendar-grid";
import { formatEventDate } from "../../lib/event-format";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";
import { EventCard } from "./EventCard";

export interface DayDetailsModalProps {
  open: boolean;
  dateKey: string | null;
  occurrences: EventOccurrence[];
  locale: Locale;
  onClose: () => void;
}

/**
 * Day-details modal reused across every calendar surface (internal + the
 * public page in Issue #5). Built on the shared `Modal` (Escape to close,
 * focus on open, backdrop click) for keyboard accessibility and iframe-safe
 * rendering (PRODUCT_BLUEPRINT.md §16).
 */
export function DayDetailsModal({ open, dateKey, occurrences, locale, onClose }: DayDetailsModalProps) {
  const dictionary = useDictionary();

  if (!dateKey) {
    return null;
  }

  const dayOccurrences = (groupOccurrencesByDate(occurrences, [dateKey]).get(dateKey) ?? [])
    .slice()
    .sort((a, b) => (a.startAt < b.startAt ? -1 : 1));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dictionary.calendar.dayModalTitle.replace("{date}", formatEventDate(dateKey, locale))}
    >
      {dayOccurrences.length === 0 ? (
        <p className="dho-cal-empty">{dictionary.calendar.noEventsOnDay}</p>
      ) : (
        <div className="dho-cal-day-modal-list">
          {dayOccurrences.map((occurrence) => (
            <EventCard
              key={`${occurrence.seriesId}-${occurrence.occurrenceDate}`}
              occurrence={occurrence}
              locale={locale}
              variant="detailed"
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
