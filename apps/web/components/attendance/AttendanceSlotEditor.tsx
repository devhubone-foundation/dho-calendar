"use client";

import type { AttendanceSlot } from "@dho/contracts";
import { Button, FormField } from "@dho/ui";

import { useDictionary } from "../../lib/i18n/use-locale";

export interface AttendanceSlotEditorProps {
  slots: AttendanceSlot[];
  onChange: (slots: AttendanceSlot[]) => void;
  /** Per-slot validation messages, keyed by index, shown next to that row. */
  slotErrors?: Record<number, string>;
}

/**
 * Reusable time-slot list editor shared by the daily attendance modal and the
 * default weekly-schedule modal (PRODUCT_BLUEPRINT.md §12.4/§12.6): any
 * number of start/end rows, each removable, plus an "add time slot" action.
 * Overlap/duplicate/ordering validation is done by the caller against the
 * shared `@dho/contracts` slot schemas so the frontend and backend never
 * disagree on what counts as valid.
 */
export function AttendanceSlotEditor({ slots, onChange, slotErrors }: AttendanceSlotEditorProps) {
  const dictionary = useDictionary();

  function updateSlot(index: number, patch: Partial<AttendanceSlot>): void {
    onChange(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  function removeSlot(index: number): void {
    onChange(slots.filter((_, i) => i !== index));
  }

  function addSlot(): void {
    onChange([...slots, { startTime: "", endTime: "" }]);
  }

  return (
    <div className="dho-slot-editor">
      {slots.map((slot, index) => (
        <div key={index} className="dho-slot-row">
          <div className="dho-slot-fields">
            <FormField
              label={dictionary.officeSettings.startTime}
              type="time"
              value={slot.startTime}
              onChange={(event) => updateSlot(index, { startTime: event.target.value })}
            />
            <FormField
              label={dictionary.officeSettings.endTime}
              type="time"
              value={slot.endTime}
              onChange={(event) => updateSlot(index, { endTime: event.target.value })}
            />
            <Button type="button" variant="secondary" size="small" onClick={() => removeSlot(index)}>
              {dictionary.attendancePage.removeSlot}
            </Button>
          </div>
          {slotErrors?.[index] ? (
            <p role="alert" className="dho-field-error">
              {slotErrors[index]}
            </p>
          ) : null}
        </div>
      ))}
      <Button type="button" variant="secondary" size="small" onClick={addSlot}>
        {dictionary.attendancePage.addSlot}
      </Button>
    </div>
  );
}
