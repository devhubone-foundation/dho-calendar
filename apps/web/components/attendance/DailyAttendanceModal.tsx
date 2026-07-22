"use client";

import { Button, Modal } from "@dho/ui";
import { attendanceExceptionInputSchema } from "@dho/contracts";
import type { AttendanceExceptionInput, AttendanceSlot, AttendanceStatus } from "@dho/contracts";
import { useEffect, useState, type FormEvent } from "react";

import { useDictionary } from "../../lib/i18n/use-locale";
import { AttendanceSlotEditor } from "./AttendanceSlotEditor";

export interface DailyAttendanceModalProps {
  open: boolean;
  /** Pre-formatted, localized label for the selected date, e.g. "Monday, 3 Aug 2026". */
  dateLabel: string;
  status: AttendanceStatus;
  slots: AttendanceSlot[];
  /** True when this date already has its own date-specific change — shows
   * the "use my default schedule" reset action (PRODUCT_BLUEPRINT.md §12.6). */
  isCustomized: boolean;
  onClose: () => void;
  onSave: (input: AttendanceExceptionInput) => Promise<void>;
  onResetToDefault: () => Promise<void>;
}

const STATUS_OPTIONS: AttendanceStatus[] = ["ATTENDING", "NOT_SURE", "NOT_ATTENDING"];

/**
 * "Edit this day" modal (PRODUCT_BLUEPRINT.md §12.6): plain-language status
 * choice plus a multi-slot time editor for Attending/Not sure. Deliberately
 * avoids words like "exception" or "override" — saving always targets the
 * one selected date, and "use my default schedule" removes the
 * date-specific change rather than exposing it as a technical concept.
 */
export function DailyAttendanceModal({
  open,
  dateLabel,
  status,
  slots,
  isCustomized,
  onClose,
  onSave,
  onResetToDefault,
}: DailyAttendanceModalProps) {
  const dictionary = useDictionary();
  const [formStatus, setFormStatus] = useState<AttendanceStatus>(status);
  const [formSlots, setFormSlots] = useState<AttendanceSlot[]>(slots);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormStatus(status);
      setFormSlots(slots);
      setSlotsError(null);
      setFieldErrors({});
      setServerError(null);
    }
  }, [open, status, slots]);

  function handleStatusChange(next: AttendanceStatus): void {
    setFormStatus(next);
    if (next === "NOT_ATTENDING") {
      // Stale slot values must never survive a switch to Not attending.
      setFormSlots([]);
    } else if (formSlots.length === 0) {
      setFormSlots([{ startTime: "", endTime: "" }]);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSlotsError(null);
    setFieldErrors({});
    setServerError(null);

    const parsed = attendanceExceptionInputSchema.safeParse({ status: formStatus, slots: formSlots });
    if (!parsed.success) {
      const nextFieldErrors: Record<number, string> = {};
      let generalError: string | null = null;
      for (const issue of parsed.error.issues) {
        const [root, index] = issue.path;
        if (root === "slots" && typeof index === "number") {
          nextFieldErrors[index] = issue.message;
        } else if (root === "slots") {
          generalError = issue.message;
        }
      }
      setFieldErrors(nextFieldErrors);
      setSlotsError(generalError ?? (Object.keys(nextFieldErrors).length > 0 ? null : dictionary.attendancePage.validationError));
      return;
    }

    setSaving(true);
    try {
      await onSave(parsed.data);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : dictionary.attendancePage.genericError);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(): Promise<void> {
    setSaving(true);
    setServerError(null);
    try {
      await onResetToDefault();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : dictionary.attendancePage.genericError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dictionary.attendancePage.editDayTitle.replace("{date}", dateLabel)}
      closeLabel={dictionary.common.close}
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="dho-stack">
        <fieldset className="dho-field">
          <legend>{dictionary.attendancePage.statusLabel}</legend>
          <div className="dho-status-options">
            {STATUS_OPTIONS.map((option) => (
              <label key={option} className="dho-status-option">
                <input
                  type="radio"
                  name="attendanceStatus"
                  checked={formStatus === option}
                  onChange={() => handleStatusChange(option)}
                />
                {dictionary.attendanceStatus[option]}
              </label>
            ))}
          </div>
        </fieldset>

        {formStatus !== "NOT_ATTENDING" ? (
          <AttendanceSlotEditor slots={formSlots} onChange={setFormSlots} slotErrors={fieldErrors} />
        ) : null}
        {slotsError ? (
          <p role="alert" className="dho-field-error">
            {slotsError}
          </p>
        ) : null}

        {isCustomized ? (
          <Button type="button" variant="secondary" onClick={() => void handleReset()} disabled={saving}>
            {dictionary.attendancePage.resetToDefault}
          </Button>
        ) : null}

        {serverError ? (
          <p role="alert" className="dho-field-error">
            {serverError}
          </p>
        ) : null}

        <div className="dho-modal-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {dictionary.attendancePage.cancel}
          </Button>
          <Button type="submit" variant="accent" disabled={saving}>
            {saving ? dictionary.attendancePage.saving : dictionary.attendancePage.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
