"use client";

import { Modal } from "@dho/ui";
import type { EventOccurrence, PublicMemberAttendance, PublicOfficeState } from "@dho/contracts";

import { groupOccurrencesByDate } from "../../lib/calendar-grid";
import { formatEventDate } from "../../lib/event-format";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";
import { EventCard } from "./EventCard";
import { PublicDayAttendance } from "./PublicDayAttendance";

export interface PublicDayInfo {
  office: PublicOfficeState;
  confirmedAttendees: PublicMemberAttendance[];
  uncertainAttendees: PublicMemberAttendance[];
}

export interface DayDetailsModalProps {
  open: boolean;
  dateKey: string | null;
  occurrences: EventOccurrence[];
  locale: Locale;
  onClose: () => void;
  /** Present only on the public page (Issue #5) — office/attendee context
   * rendered above the events list. Omitted by every authenticated-calendar
   * caller, which is unaffected by this addition. */
  publicDayInfo?: PublicDayInfo;
}

/**
 * Day-details modal reused across every calendar surface (internal + the
 * public page in Issue #5). Built on the shared `Modal` (Escape to close,
 * focus on open, backdrop click) for keyboard accessibility and iframe-safe
 * rendering (PRODUCT_BLUEPRINT.md §16).
 */
export function DayDetailsModal({
  open,
  dateKey,
  occurrences,
  locale,
  onClose,
  publicDayInfo,
}: DayDetailsModalProps) {
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
      {publicDayInfo ? (
        <PublicDayAttendance
          office={publicDayInfo.office}
          confirmedAttendees={publicDayInfo.confirmedAttendees}
          uncertainAttendees={publicDayInfo.uncertainAttendees}
          locale={locale}
        />
      ) : null}

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
