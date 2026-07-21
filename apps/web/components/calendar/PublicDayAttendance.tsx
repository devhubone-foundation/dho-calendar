"use client";

import { Avatar, Badge, pickBilingual } from "@dho/ui";
import type { PublicMemberAttendance, PublicOfficeState } from "@dho/contracts";

import { resolveUploadUrl } from "../../lib/auth/api-client";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";

export interface PublicDayAttendanceProps {
  office: PublicOfficeState;
  confirmedAttendees: PublicMemberAttendance[];
  uncertainAttendees: PublicMemberAttendance[];
  locale: Locale;
}

function AttendeeRow({
  member,
  locale,
  uncertain,
}: {
  member: PublicMemberAttendance;
  locale: Locale;
  uncertain: boolean;
}) {
  const dictionary = useDictionary();
  const qualification = pickBilingual({ bg: member.qualificationBg, en: member.qualificationEn }, locale);

  return (
    <div className="dho-cal-attendee">
      <Avatar
        name={member.fullName}
        src={member.profileImagePath ? resolveUploadUrl(member.profileImagePath) : null}
        size={40}
      />
      <div className="dho-cal-attendee-body">
        <div className="dho-cal-attendee-heading">
          <strong>{member.fullName}</strong>
          {/* Distinct badge so uncertain attendance is never confused with
              confirmed presence (PRODUCT_BLUEPRINT.md §12.3). */}
          {uncertain ? <Badge variant="muted">{dictionary.attendanceStatus.NOT_SURE}</Badge> : null}
        </div>
        <p className="dho-cal-attendee-meta">
          {qualification} · {member.startTime}–{member.endTime}
        </p>
        <p className="dho-cal-attendee-contact">
          {dictionary.calendar.contactLabel}:{" "}
          <a href={`mailto:${member.contactEmail}`}>{member.contactEmail}</a>
        </p>
      </div>
    </div>
  );
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
