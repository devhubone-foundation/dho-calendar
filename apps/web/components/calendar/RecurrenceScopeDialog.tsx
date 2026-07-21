"use client";

import { Button, Modal } from "@dho/ui";
import type { EventEditScope } from "@dho/contracts";

import { useDictionary } from "../../lib/i18n/use-locale";

export interface RecurrenceScopeDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (scope: EventEditScope) => void;
}

/** PRODUCT_BLUEPRINT.md §14.8: prompts for one of the three edit/delete
 * scopes whenever the target occurrence belongs to a recurring series. */
export function RecurrenceScopeDialog({ open, onCancel, onConfirm }: RecurrenceScopeDialogProps) {
  const dictionary = useDictionary();

  return (
    <Modal open={open} onClose={onCancel} title={dictionary.events.scopeTitle}>
      <p>{dictionary.events.scopePrompt}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
        <Button type="button" onClick={() => onConfirm("OCCURRENCE")}>
          {dictionary.events.scopeOccurrence}
        </Button>
        <Button type="button" onClick={() => onConfirm("THIS_AND_FUTURE")}>
          {dictionary.events.scopeThisAndFuture}
        </Button>
        <Button type="button" variant="danger" onClick={() => onConfirm("SERIES")}>
          {dictionary.events.scopeSeries}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {dictionary.events.scopeCancel}
        </Button>
      </div>
    </Modal>
  );
}
