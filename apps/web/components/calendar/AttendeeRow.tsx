"use client";

import { Avatar, Badge, pickBilingual } from "@dho/ui";
import type { PublicMemberAttendance } from "@dho/contracts";

import { resolveUploadUrl } from "../../lib/auth/api-client";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";

export interface AttendeeRowProps {
  member: PublicMemberAttendance;
  locale: Locale;
  uncertain: boolean;
}

/** Shared attendee presentation (avatar, name, qualification, hours,
 * contact email) reused by the day-details modal (PublicDayAttendance) and
 * the Attendance view's per-attendee modal (PRODUCT_BLUEPRINT.md §16.1). */
export function AttendeeRow({ member, locale, uncertain }: AttendeeRowProps) {
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
          {uncertain ? <Badge variant="not-sure">{dictionary.calendar.notSureBadge}</Badge> : null}
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
