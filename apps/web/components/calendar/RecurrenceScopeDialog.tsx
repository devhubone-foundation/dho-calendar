"use client";

import { Button, Modal } from "@dho/ui";
import type { EventEditScope } from "@dho/contracts";
import { useState } from "react";

import { useDictionary } from "../../lib/i18n/use-locale";

export interface RecurrenceScopeDialogProps {
  open: boolean;
  /** Styles Confirm as the danger variant for a delete flow. */
  isDestructive?: boolean;
  onCancel: () => void;
  onConfirm: (scope: EventEditScope) => void;
}

/** PRODUCT_BLUEPRINT.md §14.8 / Issue #12 mockup screen 12: three
 * clearly-labeled radio choices, each with a one-line consequence, then an
 * explicit Confirm/Cancel step (never a single accidental click). */
export function RecurrenceScopeDialog({ open, isDestructive, onCancel, onConfirm }: RecurrenceScopeDialogProps) {
  const dictionary = useDictionary();
  const [scope, setScope] = useState<EventEditScope>("OCCURRENCE");

  const options: { value: EventEditScope; label: string; description: string }[] = [
    { value: "OCCURRENCE", label: dictionary.events.scopeOccurrence, description: dictionary.events.scopeOccurrenceDesc },
    {
      value: "THIS_AND_FUTURE",
      label: dictionary.events.scopeThisAndFuture,
      description: dictionary.events.scopeThisAndFutureDesc,
    },
    { value: "SERIES", label: dictionary.events.scopeSeries, description: dictionary.events.scopeSeriesDesc },
  ];

  return (
    <Modal open={open} onClose={onCancel} title={dictionary.events.scopeTitle} closeLabel={dictionary.common.close}>
      <p>{dictionary.events.scopePrompt}</p>
      <div className="dho-scope-options" role="radiogroup" aria-label={dictionary.events.scopePrompt}>
        {options.map((option) => (
          <label key={option.value} className="dho-scope-option">
            <input
              type="radio"
              name="recurrence-scope"
              value={option.value}
              checked={scope === option.value}
              onChange={() => setScope(option.value)}
            />
            <span>
              <strong>{option.label}</strong>
              <span className="dho-scope-option-desc">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="dho-modal-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {dictionary.events.scopeCancel}
        </Button>
        <Button type="button" variant={isDestructive ? "danger" : "primary"} onClick={() => onConfirm(scope)}>
          {dictionary.events.scopeConfirm}
        </Button>
      </div>
    </Modal>
  );
}
