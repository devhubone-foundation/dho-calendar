"use client";

import { Badge, Button, Modal } from "@dho/ui";
import { updateWeeklyScheduleRequestSchema, WEEKDAYS_IN_ORDER } from "@dho/contracts";
import type { MemberWeeklyScheduleDay, Weekday, WeeklyScheduleDayInput } from "@dho/contracts";
import { useEffect, useState, type FormEvent } from "react";

import { useDictionary } from "../../lib/i18n/use-locale";
import { AttendanceSlotEditor } from "./AttendanceSlotEditor";

export interface WeeklyScheduleModalProps {
  open: boolean;
  /** Current effective weekly schedule, one entry per weekday. */
  days: MemberWeeklyScheduleDay[];
  onClose: () => void;
  onSave: (days: WeeklyScheduleDayInput[]) => Promise<void>;
}

type FormDay = WeeklyScheduleDayInput & { isInherited: boolean };

function toFormDays(days: MemberWeeklyScheduleDay[]): FormDay[] {
  return WEEKDAYS_IN_ORDER.map((weekday) => {
    const day = days.find((d) => d.weekday === weekday);
    return {
      weekday,
      attends: day?.attends ?? false,
      slots: day?.slots ?? [],
      isInherited: day?.isInherited ?? true,
    };
  });
}

/**
 * "Default weekly schedule" modal (PRODUCT_BLUEPRINT.md §12.4): the
 * member's personal recurring attendance, independent from the office's own
 * opening-hours schedule (managed separately under Office settings).
 * Changes apply to future dates only and never touch existing date-specific
 * changes, which continue to take priority (ARCHITECTURE.md §11).
 */
export function WeeklyScheduleModal({ open, days, onClose, onSave }: WeeklyScheduleModalProps) {
  const dictionary = useDictionary();
  const [formDays, setFormDays] = useState<FormDay[]>(() => toFormDays(days));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Weekday, Record<number, string>>>>({});
  const [listErrors, setListErrors] = useState<Partial<Record<Weekday, string>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormDays(toFormDays(days));
      setFieldErrors({});
      setListErrors({});
      setServerError(null);
    }
  }, [open, days]);

  function updateDay(weekday: Weekday, patch: Partial<FormDay>): void {
    setFormDays((prev) => prev.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)));
  }

  function handleAttendsChange(weekday: Weekday, attends: boolean): void {
    setFormDays((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day;
        if (!attends) return { ...day, attends: false, slots: [] };
        return { ...day, attends: true, slots: day.slots.length > 0 ? day.slots : [{ startTime: "", endTime: "" }] };
      }),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFieldErrors({});
    setListErrors({});
    setServerError(null);

    const candidate = { days: formDays.map(({ weekday, attends, slots }) => ({ weekday, attends, slots })) };
    const parsed = updateWeeklyScheduleRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      const nextFieldErrors: Partial<Record<Weekday, Record<number, string>>> = {};
      const nextListErrors: Partial<Record<Weekday, string>> = {};
      for (const issue of parsed.error.issues) {
        const [, dayIndexRaw, root, slotIndex] = issue.path;
        if (typeof dayIndexRaw !== "number" || root !== "slots") continue;
        const weekday = formDays[dayIndexRaw]?.weekday;
        if (!weekday) continue;
        if (typeof slotIndex === "number") {
          nextFieldErrors[weekday] = { ...nextFieldErrors[weekday], [slotIndex]: issue.message };
        } else {
          nextListErrors[weekday] = issue.message;
        }
      }
      setFieldErrors(nextFieldErrors);
      setListErrors(nextListErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave(parsed.data.days);
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
      title={dictionary.attendancePage.weeklyModalTitle}
      closeLabel={dictionary.common.close}
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="dho-stack">
        <p>{dictionary.attendancePage.weeklyHint}</p>

        {formDays.map((day) => (
          <div key={day.weekday} className="dho-weekday-row">
            <div className="dho-weekday-row-header">
              <label className="dho-weekday-toggle">
                <input
                  type="checkbox"
                  className="dho-checkbox-lg"
                  checked={day.attends}
                  onChange={(event) => handleAttendsChange(day.weekday, event.target.checked)}
                />
                <strong>{dictionary.weekdays[day.weekday]}</strong>
              </label>
              {day.isInherited ? <Badge variant="muted">{dictionary.attendancePage.inheritedBadge}</Badge> : null}
            </div>
            {day.attends ? (
              <AttendanceSlotEditor
                slots={day.slots}
                onChange={(slots) => updateDay(day.weekday, { slots })}
                slotErrors={fieldErrors[day.weekday]}
              />
            ) : null}
            {listErrors[day.weekday] ? (
              <p role="alert" className="dho-field-error">
                {listErrors[day.weekday]}
              </p>
            ) : null}
          </div>
        ))}

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
            {saving ? dictionary.attendancePage.saving : dictionary.attendancePage.saveChanges}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
