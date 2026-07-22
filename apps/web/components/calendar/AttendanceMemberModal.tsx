"use client";

import { Avatar, cn, Modal, pickBilingual } from "@dho/ui";
import type { PublicMemberAttendance } from "@dho/contracts";

import { resolveUploadUrl } from "../../lib/auth/api-client";
import { formatEventDate } from "../../lib/event-format";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";

export interface SelectedAttendanceMember {
  member: PublicMemberAttendance;
  uncertain: boolean;
  dateKey: string;
}

export interface AttendanceMemberModalProps {
  open: boolean;
  selected: SelectedAttendanceMember | null;
  locale: Locale;
  onClose: () => void;
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16v12H4V6Zm0 0 8 7 8-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Per-attendee details modal for the public Attendance view
 * (PRODUCT_BLUEPRINT.md §16.1): scoped to one attendee on one date, distinct
 * from the day-details modal used by the Events view. Days in the
 * Attendance view remain non-clickable; only an attendee's own stripe/row
 * opens this.
 *
 * The status/time band deliberately reuses the same colored-stripe tokens
 * as the timeline (dho-status-attending and dho-status-not-sure) so this
 * reads as a zoomed-in view of the exact stripe the visitor tapped, rather
 * than an unrelated info card.
 */
export function AttendanceMemberModal({ open, selected, locale, onClose }: AttendanceMemberModalProps) {
  const dictionary = useDictionary();

  if (!selected) {
    return null;
  }

  const { member, uncertain, dateKey } = selected;
  const qualification = pickBilingual({ bg: member.qualificationBg, en: member.qualificationEn }, locale);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dictionary.calendar.attendanceMemberModalTitle.replace("{date}", formatEventDate(dateKey, locale))}
      closeLabel={dictionary.calendar.closeModal}
    >
      <div className="dho-attn-modal">
        <div className="dho-attn-modal-identity">
          <Avatar
            name={member.fullName}
            src={member.profileImagePath ? resolveUploadUrl(member.profileImagePath) : null}
            size={56}
          />
          <div className="dho-attn-modal-identity-text">
            <p className="dho-attn-modal-name">{member.fullName}</p>
            {qualification ? <p className="dho-attn-modal-role">{qualification}</p> : null}
          </div>
        </div>

        <div className={cn("dho-attn-modal-status", uncertain && "dho-attn-modal-status--not-sure")}>
          <span className="dho-attn-modal-status-label">
            {uncertain ? dictionary.calendar.notSureBadge : dictionary.calendar.legendAttending}
          </span>
          <span className="dho-attn-modal-status-time">
            {member.startTime}–{member.endTime}
          </span>
        </div>

        <a
          className="dho-button dho-button--secondary dho-attn-modal-contact"
          href={`mailto:${member.contactEmail}`}
          title={member.contactEmail}
          aria-label={`${dictionary.calendar.contactLabel}: ${member.contactEmail}`}
        >
          <MailIcon />
          {dictionary.calendar.contactButtonLabel}
        </a>
      </div>
    </Modal>
  );
}
