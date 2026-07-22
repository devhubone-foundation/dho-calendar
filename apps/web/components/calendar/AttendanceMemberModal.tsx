"use client";

import { Modal } from "@dho/ui";
import type { PublicMemberAttendance } from "@dho/contracts";

import { formatEventDate } from "../../lib/event-format";
import type { Locale } from "../../lib/i18n/locale";
import { useDictionary } from "../../lib/i18n/use-locale";
import { AttendeeRow } from "./AttendeeRow";

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

/**
 * Per-attendee details modal for the public Attendance view
 * (PRODUCT_BLUEPRINT.md §16.1): scoped to one attendee on one date, distinct
 * from the day-details modal used by the Events view. Days in the
 * Attendance view remain non-clickable; only an attendee's own stripe/row
 * opens this.
 */
export function AttendanceMemberModal({ open, selected, locale, onClose }: AttendanceMemberModalProps) {
  const dictionary = useDictionary();

  if (!selected) {
    return null;
  }

  const { member, uncertain, dateKey } = selected;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${member.fullName} · ${formatEventDate(dateKey, locale)}`}
      closeLabel={dictionary.calendar.closeModal}
    >
      <AttendeeRow member={member} locale={locale} uncertain={uncertain} />
    </Modal>
  );
}
