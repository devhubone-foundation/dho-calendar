"use client";

import { Avatar, cn } from "@dho/ui";
import type { PublicCalendarDay } from "@dho/contracts";

import { resolveUploadUrl } from "../../lib/auth/api-client";
import { todayKey } from "../../lib/calendar-grid";
import {
  computeWeekTimeRange,
  formatHourMark,
  hourMarks,
  timeOfDayToMinutes,
  type TimeRange,
} from "../../lib/calendar-time-grid";
import { formatWeekdayAndDay } from "../../lib/event-format";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";

export interface AttendanceTimelineViewProps {
  /** Exactly the next 7 days (today first through today+6), already
   * resolved by the caller — this component never pages or looks back. */
  days: PublicCalendarDay[];
  locale: Locale;
}

function percentOffset(minutes: number, range: TimeRange): number {
  const span = range.endMinutes - range.startMinutes;
  if (span <= 0) return 0;
  const clamped = Math.min(Math.max(minutes, range.startMinutes), range.endMinutes);
  return ((clamped - range.startMinutes) / span) * 100;
}

/**
 * Public calendar Attendance view (PRODUCT_BLUEPRINT.md §15.1.1): a
 * horizontal, attendance-only timeline for the next 7 days. Each day is a
 * row; each attending/maybe-attending member is a sub-row with a photo
 * badge and an hour stripe positioned along a shared time axis. No events,
 * no navigation, and days are not clickable — everything relevant is
 * already visible without interaction.
 */
export function AttendanceTimelineView({ days, locale }: AttendanceTimelineViewProps) {
  const dictionary = useDictionary();
  const range = computeWeekTimeRange(days, []);
  const marks = hourMarks(range);
  const today = todayKey();

  return (
    <div className="dho-attn-timeline">
      <div className="dho-attn-axis-row" aria-hidden="true">
        <div className="dho-attn-axis-spacer" />
        <div className="dho-attn-axis-track">
          {marks.map((minutes, index) => {
            const offset = percentOffset(minutes, range);
            // Edge marks anchor inward instead of centering, so the label
            // text never bleeds past the track (no page-level horizontal
            // scroll at narrow iframe widths, PRODUCT_BLUEPRINT.md §21.3).
            const align = index === 0 ? "start" : index === marks.length - 1 ? "end" : "center";
            return (
              <span
                key={minutes}
                className={cn("dho-attn-axis-mark", `dho-attn-axis-mark--${align}`)}
                style={{ left: `${offset}%` }}
              >
                {formatHourMark(minutes)}
              </span>
            );
          })}
        </div>
      </div>

      {days.map((day) => {
        const isToday = day.date === today;
        const members = [
          ...day.confirmedAttendees.map((member) => ({ member, uncertain: false as const })),
          ...day.uncertainAttendees.map((member) => ({ member, uncertain: true as const })),
        ];

        return (
          <section key={day.date} className={cn("dho-attn-day", isToday && "dho-attn-day--today")}>
            <h3 className="dho-attn-day-heading">
              {formatWeekdayAndDay(day.date, locale)}
              {day.office.isChanged ? (
                <span
                  className="dho-cal-changed-dot"
                  title={dictionary.calendar.officeHoursChanged}
                  aria-hidden="true"
                />
              ) : null}
            </h3>

            {!day.office.isOpen ? (
              <p className="dho-attn-state dho-attn-state--closed">{dictionary.calendar.officeClosed}</p>
            ) : members.length === 0 ? (
              <p className="dho-attn-state dho-attn-state--rest">{dictionary.calendar.restDay}</p>
            ) : (
              <div className="dho-attn-day-rows">
                {day.office.startTime && day.office.endTime ? (
                  <div className="dho-attn-office-row">
                    <div className="dho-attn-office-spacer" />
                    <div className="dho-attn-office-track">
                      <div
                        className="dho-attn-office-band"
                        style={{
                          left: `${percentOffset(timeOfDayToMinutes(day.office.startTime), range)}%`,
                          width: `${
                            percentOffset(timeOfDayToMinutes(day.office.endTime), range) -
                            percentOffset(timeOfDayToMinutes(day.office.startTime), range)
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {members.map(({ member, uncertain }) => {
                  const left = percentOffset(timeOfDayToMinutes(member.startTime), range);
                  const width = Math.max(4, percentOffset(timeOfDayToMinutes(member.endTime), range) - left);
                  return (
                    <div key={member.contactEmail} className="dho-attn-member-row">
                      <div className="dho-attn-member-identity">
                        <Avatar
                          name={member.fullName}
                          src={member.profileImagePath ? resolveUploadUrl(member.profileImagePath) : null}
                          size={28}
                        />
                        <span className="dho-attn-member-name">{member.fullName}</span>
                      </div>
                      <div className="dho-attn-member-track">
                        <div
                          className={cn("dho-attn-member-stripe", uncertain && "dho-attn-member-stripe--not-sure")}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${member.fullName} · ${member.startTime}–${member.endTime}${
                            uncertain ? ` (${dictionary.calendar.notSureBadge})` : ""
                          }`}
                        >
                          <span className="dho-attn-member-stripe-time">
                            {member.startTime}–{member.endTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <div className="dho-attn-legend" role="note" aria-label={dictionary.calendar.legendTitle}>
        <span className="dho-legend-item">
          <span className="dho-legend-swatch dho-legend-swatch--attending" aria-hidden="true" />
          {dictionary.calendar.legendAttending}
        </span>
        <span className="dho-legend-item">
          <span className="dho-legend-swatch dho-legend-swatch--not-sure" aria-hidden="true" />
          {dictionary.calendar.legendNotSure}
        </span>
        <span className="dho-legend-item">
          <span className="dho-legend-swatch dho-legend-swatch--closed" aria-hidden="true" />
          {dictionary.calendar.legendClosed}
        </span>
        <span className="dho-legend-item">
          <span className="dho-legend-swatch dho-legend-swatch--rest" aria-hidden="true" />
          {dictionary.calendar.legendRestDay}
        </span>
      </div>
    </div>
  );
}
