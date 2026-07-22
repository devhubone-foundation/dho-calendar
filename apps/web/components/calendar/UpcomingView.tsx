"use client";

import { Avatar, Badge } from "@dho/ui";
import type { EventOccurrence, PublicCalendarDay } from "@dho/contracts";

import { resolveUploadUrl } from "../../lib/auth/api-client";
import { formatEventDate } from "../../lib/event-format";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";
import { EventCard } from "./EventCard";

export interface UpcomingViewProps {
  occurrences: EventOccurrence[];
  /** When provided, each date group also shows Hub open/closed status and a
   * condensed "who's here" summary — the safest mobile/iframe fallback, so
   * it carries the same at-a-glance information as Month/Week (Issue #12). */
  days?: PublicCalendarDay[];
  locale: Locale;
}

const MAX_SUMMARY_AVATARS = 4;

/** Chronological, date-grouped list prioritizing future events and Hub
 * open days — usable on narrow widths (PRODUCT_BLUEPRINT.md §15.4). */
export function UpcomingView({ occurrences, days, locale }: UpcomingViewProps) {
  const dictionary = useDictionary();
  const sorted = occurrences.slice().sort((a, b) => (a.startAt < b.startAt ? -1 : 1));

  const eventsByDate = new Map<string, EventOccurrence[]>();
  for (const occurrence of sorted) {
    const list = eventsByDate.get(occurrence.occurrenceDate) ?? [];
    list.push(occurrence);
    eventsByDate.set(occurrence.occurrenceDate, list);
  }

  const openDays = (days ?? []).filter((day) => day.isPublicOpenDay);
  const dateKeys = Array.from(new Set([...eventsByDate.keys(), ...openDays.map((day) => day.date)])).sort();

  if (dateKeys.length === 0) {
    return <p className="dho-cal-empty">{dictionary.calendar.noEventsUpcoming}</p>;
  }

  const daysByDate = new Map((days ?? []).map((day) => [day.date, day]));

  return (
    <div className="dho-cal-upcoming-list">
      {dateKeys.map((dateKey) => {
        const day = daysByDate.get(dateKey);
        const events = eventsByDate.get(dateKey) ?? [];

        return (
          <section key={dateKey} className="dho-cal-upcoming-group">
            <div className="dho-cal-upcoming-group-header">
              <h3 className="dho-cal-upcoming-date">{formatEventDate(dateKey, locale)}</h3>
              {day ? (
                <span className="dho-cal-upcoming-status">
                  {day.isPublicOpenDay
                    ? `${dictionary.calendar.officeOpen} · ${day.office.startTime}–${day.office.endTime}`
                    : dictionary.calendar.officeClosed}
                </span>
              ) : null}
            </div>

            {events.map((occurrence) => (
              <EventCard key={`${occurrence.seriesId}-${occurrence.occurrenceDate}`} occurrence={occurrence} locale={locale} variant="detailed" />
            ))}

            {day && (day.confirmedAttendees.length > 0 || day.uncertainAttendees.length > 0) ? (
              <div className="dho-cal-upcoming-summary">
                <div className="dho-cal-month-avatar-images">
                  {day.confirmedAttendees.slice(0, MAX_SUMMARY_AVATARS).map((member) => (
                    <Avatar
                      key={member.contactEmail}
                      name={member.fullName}
                      src={member.profileImagePath ? resolveUploadUrl(member.profileImagePath) : null}
                      size={24}
                      className="dho-cal-month-avatar"
                    />
                  ))}
                </div>
                {day.confirmedAttendees.length > 0 ? (
                  <Badge variant="success">
                    {day.confirmedAttendees.length} {dictionary.calendar.confirmedAttendees}
                  </Badge>
                ) : null}
                {day.uncertainAttendees.length > 0 ? (
                  <Badge variant="not-sure">
                    {day.uncertainAttendees.length} {dictionary.calendar.uncertainAttendees}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
