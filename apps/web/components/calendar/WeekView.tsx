"use client";

import { Avatar, cn } from "@dho/ui";
import type { EventOccurrence, PublicCalendarDay } from "@dho/contracts";

import { resolveUploadUrl } from "../../lib/auth/api-client";
import { occurrenceDateSpan, getWeekDates, groupOccurrencesByDate, todayKey } from "../../lib/calendar-grid";
import {
  computeWeekTimeRange,
  formatHourMark,
  hourMarks,
  instantToOfficeMinutes,
  minutesToOffsetRem,
  rangeHeightRem,
  timeOfDayToMinutes,
} from "../../lib/calendar-time-grid";
import type { Locale } from "../../lib/i18n/locale";
import { formatWeekdayAndDay } from "../../lib/event-format";
import { useDictionary } from "../../lib/i18n/use-locale";
import { activatableProps } from "./activatable";
import { EventCard } from "./EventCard";

export interface WeekViewProps {
  /** Any date within the week to display. */
  anchorDateKey: string;
  occurrences: EventOccurrence[];
  /** Full public day data (office hours + attendance intervals) — when
   * provided, renders a real time-grid instead of a plain event list. */
  days?: PublicCalendarDay[];
  locale: Locale;
  onSelectDate: (dateKey: string) => void;
}

function isPositionable(occurrence: EventOccurrence): boolean {
  if (occurrence.isAllDay) return false;
  const { startKey, endKey } = occurrenceDateSpan(occurrence);
  return startKey === endKey;
}

/** Time-based week view: an office-open band, mentor attendance intervals,
 * and event blocks positioned by their actual start/end time — replacing
 * the plain per-day event list so office hours and who's around are visible
 * without opening the day modal (Issue #12). Falls back to the simple list
 * when no `days` data is available (e.g. the internal calendar). */
export function WeekView({ anchorDateKey, occurrences, days, locale, onSelectDate }: WeekViewProps) {
  const dictionary = useDictionary();
  const dates = getWeekDates(anchorDateKey);
  const grouped = groupOccurrencesByDate(occurrences, dates);
  const today = todayKey();

  if (!days) {
    return (
      <div className="dho-cal-week-grid" role="grid" aria-label={dictionary.calendar.viewWeek}>
        {dates.map((dateKey) => {
          const dayOccurrences = (grouped.get(dateKey) ?? []).slice().sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
          return (
            <div key={dateKey} className={cn("dho-cal-week-column", dateKey === today && "dho-cal-week-column--today")}>
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

  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const visibleDays = dates.map((dateKey) => daysByDate.get(dateKey)).filter((day): day is PublicCalendarDay => Boolean(day));
  const range = computeWeekTimeRange(visibleDays, occurrences);
  const marks = hourMarks(range);
  const bodyHeight = rangeHeightRem(range);

  return (
    <div className="dho-cal-week-scroll" role="grid" aria-label={dictionary.calendar.viewWeek}>
      <div className="dho-cal-week-grid-inner">
        <div className="dho-cal-week-axis">
          <div className="dho-cal-week-axis-header" aria-hidden="true" />
          <div className="dho-cal-week-axis-marks" style={{ height: `${bodyHeight}rem` }}>
            {marks.map((minutes) => (
              <span
                key={minutes}
                className="dho-cal-week-axis-mark"
                style={{ top: `${minutesToOffsetRem(minutes, range)}rem` }}
              >
                {formatHourMark(minutes)}
              </span>
            ))}
          </div>
        </div>

        <div className="dho-cal-week-columns">
          {dates.map((dateKey) => {
            const day = daysByDate.get(dateKey);
            const dayOccurrences = grouped.get(dateKey) ?? [];
            const allDayOccurrences = dayOccurrences.filter((occurrence) => !isPositionable(occurrence));
            const timedOccurrences = dayOccurrences.filter(isPositionable);
            const isToday = dateKey === today;

            return (
              <div key={dateKey} className={cn("dho-cal-week-col", isToday && "dho-cal-week-col--today")}>
                <div className="dho-cal-week-col-header" {...activatableProps(() => onSelectDate(dateKey))}>
                  {formatWeekdayAndDay(dateKey, locale)}
                </div>

                {allDayOccurrences.length > 0 ? (
                  <div className="dho-cal-week-allday">
                    {allDayOccurrences.map((occurrence) => (
                      <EventCard
                        key={`${occurrence.seriesId}-${occurrence.occurrenceDate}-allday`}
                        occurrence={occurrence}
                        locale={locale}
                        variant="compact"
                        onActivate={() => onSelectDate(dateKey)}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="dho-cal-week-col-body" style={{ height: `${bodyHeight}rem` }}>
                  {day?.office.isOpen && day.office.startTime && day.office.endTime ? (
                    <div
                      className="dho-cal-week-office-band"
                      style={{
                        top: `${minutesToOffsetRem(timeOfDayToMinutes(day.office.startTime), range)}rem`,
                        height: `${
                          minutesToOffsetRem(timeOfDayToMinutes(day.office.endTime), range) -
                          minutesToOffsetRem(timeOfDayToMinutes(day.office.startTime), range)
                        }rem`,
                      }}
                      aria-hidden="true"
                    />
                  ) : null}

                  {day?.confirmedAttendees.flatMap((member) =>
                    member.slots.map((slot, index) => {
                      const top = minutesToOffsetRem(timeOfDayToMinutes(slot.startTime), range);
                      const height = Math.max(1.5, minutesToOffsetRem(timeOfDayToMinutes(slot.endTime), range) - top);
                      return (
                        <div
                          key={`${member.contactEmail}-${index}`}
                          className="dho-cal-week-attendee-block"
                          style={{ top: `${top}rem`, height: `${height}rem` }}
                          title={`${member.fullName} · ${slot.startTime}–${slot.endTime}`}
                        >
                          <Avatar
                            name={member.fullName}
                            src={member.profileImagePath ? resolveUploadUrl(member.profileImagePath) : null}
                            size={16}
                          />
                          <span className="dho-cal-week-attendee-name">{member.fullName}</span>
                        </div>
                      );
                    }),
                  )}

                  {day?.uncertainAttendees.flatMap((member) =>
                    member.slots.map((slot, index) => {
                      const top = minutesToOffsetRem(timeOfDayToMinutes(slot.startTime), range);
                      const height = Math.max(1.5, minutesToOffsetRem(timeOfDayToMinutes(slot.endTime), range) - top);
                      return (
                        <div
                          key={`${member.contactEmail}-${index}`}
                          className="dho-cal-week-attendee-block dho-cal-week-attendee-block--not-sure"
                          style={{ top: `${top}rem`, height: `${height}rem` }}
                          title={`${member.fullName} (${dictionary.calendar.notSureBadge}) · ${slot.startTime}–${slot.endTime}`}
                        >
                          <Avatar
                            name={member.fullName}
                            src={member.profileImagePath ? resolveUploadUrl(member.profileImagePath) : null}
                            size={16}
                          />
                          <span className="dho-cal-week-attendee-name">{member.fullName}</span>
                        </div>
                      );
                    }),
                  )}

                  {timedOccurrences.map((occurrence) => {
                    const startMinutes = instantToOfficeMinutes(occurrence.startAt);
                    const endMinutes = instantToOfficeMinutes(occurrence.endAt);
                    const top = minutesToOffsetRem(startMinutes, range);
                    const height = Math.max(1.5, minutesToOffsetRem(endMinutes, range) - top);
                    return (
                      <button
                        key={`${occurrence.seriesId}-${occurrence.occurrenceDate}`}
                        type="button"
                        className="dho-cal-week-event-block"
                        style={{ top: `${top}rem`, height: `${height}rem` }}
                        onClick={() => onSelectDate(dateKey)}
                      >
                        {locale === "bg" ? occurrence.titleBg : occurrence.titleEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
