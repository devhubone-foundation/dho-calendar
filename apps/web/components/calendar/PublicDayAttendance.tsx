"use client";

import { Badge } from "@dho/ui";
import type { PublicMemberAttendance, PublicOfficeState } from "@dho/contracts";

import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";
import { AttendeeRow } from "./AttendeeRow";

export interface PublicDayAttendanceProps {
  office: PublicOfficeState;
  confirmedAttendees: PublicMemberAttendance[];
  uncertainAttendees: PublicMemberAttendance[];
  locale: Locale;
}

/** Public office-state + attendee section for the day-details modal (Issue
 * #5, PRODUCT_BLUEPRINT.md §16). Only rendered when the office is
 * effectively open — a closed date never has clamped confirmed/uncertain
 * attendees to show (ARCHITECTURE.md §11), so the section is omitted rather
 * than showing a contradictory "no attendees" message next to "office closed". */
export function PublicDayAttendance({
  office,
  confirmedAttendees,
  uncertainAttendees,
  locale,
}: PublicDayAttendanceProps) {
  const dictionary = useDictionary();

  return (
    <section className="dho-cal-day-office">
      <p className="dho-cal-day-office-state">
        <span
          className={`dho-cal-office-dot ${office.isOpen ? "dho-cal-office-dot--open" : "dho-cal-office-dot--closed"}`}
          aria-hidden="true"
        />
        {office.isOpen
          ? `${dictionary.calendar.officeOpen} ${office.startTime}–${office.endTime}`
          : dictionary.calendar.officeClosed}
        {office.isChanged ? <Badge variant="muted">{dictionary.calendar.officeHoursChanged}</Badge> : null}
      </p>

      {office.isOpen ? (
        confirmedAttendees.length === 0 && uncertainAttendees.length === 0 ? (
          <p className="dho-cal-empty">{dictionary.calendar.noConfirmedAttendees}</p>
        ) : (
          <>
            {confirmedAttendees.length > 0 ? (
              <div className="dho-cal-attendee-group">
                <h4>{dictionary.calendar.confirmedAttendees}</h4>
                {confirmedAttendees.map((member) => (
                  <AttendeeRow key={member.contactEmail} member={member} locale={locale} uncertain={false} />
                ))}
              </div>
            ) : null}
            {uncertainAttendees.length > 0 ? (
              <div className="dho-cal-attendee-group">
                <h4>{dictionary.calendar.uncertainAttendees}</h4>
                {uncertainAttendees.map((member) => (
                  <AttendeeRow key={member.contactEmail} member={member} locale={locale} uncertain />
                ))}
              </div>
            ) : null}
          </>
        )
      ) : null}
    </section>
  );
}
