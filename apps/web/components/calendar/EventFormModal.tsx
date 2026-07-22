"use client";

import { Button, FormField, Modal } from "@dho/ui";
import { WEEKDAYS_IN_ORDER, type Weekday } from "@dho/contracts";
import type { FormEvent } from "react";

import type { EventFormValues } from "../../lib/event-form";
import { useDictionary } from "../../lib/i18n/use-locale";

export interface EventFormModalProps {
  open: boolean;
  title: string;
  submitLabel: string;
  submittingLabel: string;
  submitting: boolean;
  /** Recurrence can only be set/changed when creating or editing the entire
   * series — an occurrence-scope or this+future edit keeps the series'
   * existing pattern (PRODUCT_BLUEPRINT.md §14.8). */
  allowRecurrenceEdit: boolean;
  values: EventFormValues;
  onChange: (values: EventFormValues) => void;
  error?: string | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export function EventFormModal({
  open,
  title,
  submitLabel,
  submittingLabel,
  submitting,
  allowRecurrenceEdit,
  values,
  onChange,
  error,
  onSubmit,
  onCancel,
}: EventFormModalProps) {
  const dictionary = useDictionary();

  function update(partial: Partial<EventFormValues>): void {
    onChange({ ...values, ...partial });
  }

  function toggleWeekday(weekday: Weekday): void {
    const has = values.byWeekdays.includes(weekday);
    update({
      byWeekdays: has ? values.byWeekdays.filter((w) => w !== weekday) : [...values.byWeekdays, weekday],
    });
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Modal open={open} onClose={onCancel} title={title} closeLabel={dictionary.common.close}>
      <form onSubmit={handleSubmit} className="dho-stack">
        <p>{dictionary.events.publicNotice}</p>

        <div className="dho-field-pair">
          <FormField
            label={dictionary.events.titleBg}
            value={values.titleBg}
            onChange={(event) => update({ titleBg: event.target.value })}
            required
          />
          <FormField
            label={dictionary.events.titleEn}
            value={values.titleEn}
            onChange={(event) => update({ titleEn: event.target.value })}
            required
          />
        </div>

        <div className="dho-field-pair">
          <div className="dho-field">
            <label htmlFor="event-description-bg">{dictionary.events.descriptionBg}</label>
            <textarea
              id="event-description-bg"
              className="dho-input"
              rows={3}
              value={values.descriptionBg}
              onChange={(event) => update({ descriptionBg: event.target.value })}
            />
          </div>
          <div className="dho-field">
            <label htmlFor="event-description-en">{dictionary.events.descriptionEn}</label>
            <textarea
              id="event-description-en"
              className="dho-input"
              rows={3}
              value={values.descriptionEn}
              onChange={(event) => update({ descriptionEn: event.target.value })}
            />
          </div>
        </div>

        <label className="dho-checkbox-row" htmlFor="event-all-day">
          <input
            id="event-all-day"
            type="checkbox"
            checked={values.isAllDay}
            onChange={(event) => update({ isAllDay: event.target.checked })}
          />
          {dictionary.events.isAllDay}
        </label>

        <div className="dho-field-pair">
          <FormField
            label={dictionary.events.startAt}
            type={values.isAllDay ? "date" : "datetime-local"}
            value={values.startAt}
            onChange={(event) => update({ startAt: event.target.value })}
            required
          />
          <FormField
            label={dictionary.events.endAt}
            type={values.isAllDay ? "date" : "datetime-local"}
            value={values.endAt}
            onChange={(event) => update({ endAt: event.target.value })}
            required
          />
        </div>

        <FormField
          label={dictionary.events.location}
          value={values.location}
          onChange={(event) => update({ location: event.target.value })}
          required
        />

        {allowRecurrenceEdit ? (
          <div className="dho-field">
            <label htmlFor="event-recurrence-enabled">{dictionary.events.recurrence}</label>
            <select
              id="event-recurrence-enabled"
              className="dho-input"
              value={values.recurrenceEnabled ? "WEEKLY" : "NONE"}
              onChange={(event) => update({ recurrenceEnabled: event.target.value === "WEEKLY" })}
            >
              <option value="NONE">{dictionary.events.recurrenceNone}</option>
              <option value="WEEKLY">{dictionary.events.recurrenceWeekly}</option>
            </select>
          </div>
        ) : null}

        {allowRecurrenceEdit && values.recurrenceEnabled ? (
          <>
            <div className="dho-field">
              <span>{dictionary.events.onWeekdays}</span>
              <div className="dho-checkbox-group">
                {WEEKDAYS_IN_ORDER.map((weekday) => (
                  <label key={weekday} className="dho-checkbox-row">
                    <input
                      type="checkbox"
                      checked={values.byWeekdays.includes(weekday)}
                      onChange={() => toggleWeekday(weekday)}
                    />
                    {dictionary.weekdays[weekday]}
                  </label>
                ))}
              </div>
            </div>

            <div className="dho-field">
              <span>{dictionary.events.endCondition}</span>
              <div className="dho-checkbox-group">
                <label className="dho-checkbox-row">
                  <input
                    type="radio"
                    name="event-end-type"
                    checked={values.endType === "COUNT"}
                    onChange={() => update({ endType: "COUNT" })}
                  />
                  {dictionary.events.endAfterCount}
                </label>
                <label className="dho-checkbox-row">
                  <input
                    type="radio"
                    name="event-end-type"
                    checked={values.endType === "UNTIL"}
                    onChange={() => update({ endType: "UNTIL" })}
                  />
                  {dictionary.events.endOnDate}
                </label>
              </div>
            </div>

            {values.endType === "COUNT" ? (
              <FormField
                label={dictionary.events.occurrenceCount}
                type="number"
                min={1}
                max={200}
                value={values.count}
                onChange={(event) => update({ count: event.target.value })}
              />
            ) : (
              <FormField
                label={dictionary.events.untilDate}
                type="date"
                value={values.until}
                onChange={(event) => update({ until: event.target.value })}
              />
            )}
          </>
        ) : null}

        {error ? (
          <p role="alert" className="dho-field-error">
            {error}
          </p>
        ) : null}

        <div className="dho-modal-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {dictionary.events.cancel}
          </Button>
          <Button type="submit" variant="accent" disabled={submitting}>
            {submitting ? submittingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
