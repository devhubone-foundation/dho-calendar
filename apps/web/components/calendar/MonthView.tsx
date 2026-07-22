"use client";

import { Avatar, Badge, Button, cn } from "@dho/ui";
import type { EventOccurrence, PublicCalendarDay } from "@dho/contracts";

import { resolveUploadUrl } from "../../lib/auth/api-client";
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
  /** Simple open/closed augmentation (internal calendar, no attendee data). */
  officeOpenDates?: Set<string>;
  /** Full public day data (office hours + confirmed/uncertain attendees) —
   * when provided this drives the richer "at a glance" cell described in
   * Issue #12 instead of the plain open/closed dot. */
  days?: PublicCalendarDay[];
  locale: Locale;
  onSelectDate: (dateKey: string) => void;
  /** Renders a "switch to list view" banner under the grid for narrow
   * screens, where a dense month grid is hardest to read at a glance. */
  onSwitchToUpcoming?: () => void;
}

const MAX_VISIBLE_EVENTS = 3;
const MAX_VISIBLE_AVATARS = 3;

/** Compact month overview. Each cell surfaces open/closed status, effective
 * hours, confirmed-mentor avatars, and events without requiring a click —
 * the redesign's top priority (Issue #12). */
export function MonthView({
  year,
  month,
  occurrences,
  officeOpenDates,
  days,
  locale,
  onSelectDate,
  onSwitchToUpcoming,
}: MonthViewProps) {
  const dictionary = useDictionary();
  const dates = getMonthGridDates(year, month);
  const grouped = groupOccurrencesByDate(occurrences, dates);
  const today = todayKey();
  const daysByDate = days ? new Map(days.map((day) => [day.date, day])) : undefined;

  return (
    <>
      <div className="dho-cal-month-grid" role="grid" aria-label={dictionary.calendar.viewMonth}>
        {dates.map((dateKey) => {
          const dayOccurrences = grouped.get(dateKey) ?? [];
          const isCurrentMonth = new Date(`${dateKey}T00:00:00.000Z`).getUTCMonth() === month;
          const isToday = dateKey === today;
          const visible = dayOccurrences.slice(0, MAX_VISIBLE_EVENTS);
          const overflow = dayOccurrences.length - visible.length;
          const day = daysByDate?.get(dateKey);
          const officeIsOpen = day ? day.office.isOpen : officeOpenDates?.has(dateKey);
          const isConfirmedOpen = day ? day.isPublicOpenDay : officeOpenDates?.has(dateKey);
          const uncertainOnly = day && !day.isPublicOpenDay && day.uncertainAttendees.length > 0;

          return (
            <div
              key={dateKey}
              className={cn(
                "dho-cal-month-cell",
                !isCurrentMonth && "dho-cal-month-cell--outside",
                isToday && "dho-cal-month-cell--today",
                day && isConfirmedOpen && "dho-cal-month-cell--open",
                day && !isConfirmedOpen && "dho-cal-month-cell--muted",
              )}
              {...activatableProps(() => onSelectDate(dateKey))}
            >
              <div className="dho-cal-month-cell-header">
                <span className="dho-cal-month-cell-date">{Number(dateKey.slice(8, 10))}</span>
                {day?.office.isChanged ? (
                  <span
                    className="dho-cal-changed-dot"
                    title={dictionary.calendar.officeHoursChanged}
                    aria-hidden="true"
                  />
                ) : null}
                {!day && officeOpenDates ? (
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

              {visible.length > 0 || overflow > 0 ? (
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
              ) : null}

              {day && isConfirmedOpen ? (
                <div className="dho-cal-month-cell-hours">
                  {day.office.startTime}–{day.office.endTime}
                </div>
              ) : null}

              {day && isConfirmedOpen && day.confirmedAttendees.length > 0 ? (
                <div className="dho-cal-month-avatar-row" aria-hidden="true">
                  <span className="dho-cal-month-avatar-images">
                    {day.confirmedAttendees.slice(0, MAX_VISIBLE_AVATARS).map((member) => (
                      <Avatar
                        key={member.contactEmail}
                        name={member.fullName}
                        src={member.profileImagePath ? resolveUploadUrl(member.profileImagePath) : null}
                        size={22}
                        className="dho-cal-month-avatar"
                      />
                    ))}
                    {day.confirmedAttendees.length > MAX_VISIBLE_AVATARS ? (
                      <span className="dho-cal-avatar-overflow">
                        +{day.confirmedAttendees.length - MAX_VISIBLE_AVATARS}
                      </span>
                    ) : null}
                  </span>
                  {/* Condensed tablet/phone fallback for the avatar row above. */}
                  <span className="dho-cal-month-count-badge">
                    <span className="dho-cal-office-dot dho-cal-office-dot--open" />
                    {day.confirmedAttendees.length}
                  </span>
                </div>
              ) : null}

              {uncertainOnly ? (
                <Badge variant="not-sure" className="dho-cal-month-not-sure">
                  {dictionary.calendar.notSureBadge} · {day.uncertainAttendees.length}
                </Badge>
              ) : null}
            </div>
          );
        })}
      </div>

      {onSwitchToUpcoming ? (
        <div className="dho-cal-mobile-fallback">
          <span>{dictionary.calendar.viewAsListPrompt}</span>
          <Button variant="secondary" size="small" onClick={onSwitchToUpcoming}>
            {dictionary.calendar.viewAsListAction}
          </Button>
        </div>
      ) : null}
    </>
  );
}
