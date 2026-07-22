"use client";

import { Badge, Button, Card, Modal, pickBilingual } from "@dho/ui";
import type { EventEditScope, EventOccurrence } from "@dho/contracts";
import { useEffect, useState } from "react";

import {
  ApiError,
  createEvent,
  deleteEventOccurrence,
  deleteEventSeries,
  deleteEventSeriesFromOccurrence,
  getEvent,
  listEvents,
  removeEventCover,
  updateEventOccurrence,
  updateEventSeries,
  updateEventSeriesFromOccurrence,
  uploadEventCover,
} from "../../../../lib/auth/api-client";
import { useAuth } from "../../../../lib/auth/auth-context";
import { defaultHorizonRange } from "../../../../lib/date-range";
import {
  emptyEventFormValues,
  type EventFormValues,
  formValuesToContentRequest,
  formValuesToCreateRequest,
  formValuesToSeriesUpdateRequest,
  occurrenceToFormValues,
  seriesDetailToFormValues,
} from "../../../../lib/event-form";
import { formatEventDate, formatEventTime } from "../../../../lib/event-format";
import { useDictionary, useLocale } from "../../../../lib/i18n/use-locale";
import { EventCoverImage } from "../../../../components/calendar/EventCoverImage";
import { EventFormModal } from "../../../../components/calendar/EventFormModal";
import { RecurrenceScopeDialog } from "../../../../components/calendar/RecurrenceScopeDialog";

type FormMode = "create" | "series" | "occurrence" | "future";

export default function EventsPage() {
  const { accessToken } = useAuth();
  const dictionary = useDictionary();
  const locale = useLocale();

  const [occurrences, setOccurrences] = useState<EventOccurrence[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [formValues, setFormValues] = useState<EventFormValues>(emptyEventFormValues());
  const [formTargetSeriesId, setFormTargetSeriesId] = useState<string | null>(null);
  const [formTargetOccurrenceDate, setFormTargetOccurrenceDate] = useState<string | null>(null);
  const [formExpectedUpdatedAt, setFormExpectedUpdatedAt] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [scopePrompt, setScopePrompt] = useState<{ occurrence: EventOccurrence; action: "edit" | "delete" } | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] = useState<{ occurrence: EventOccurrence; scope: EventEditScope } | null>(
    null,
  );

  const [coverBusySeriesId, setCoverBusySeriesId] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<{ seriesId: string; message: string } | null>(null);

  async function loadEvents(): Promise<void> {
    if (!accessToken) return;
    try {
      const range = defaultHorizonRange();
      const result = await listEvents(range, accessToken);
      setOccurrences(result.occurrences.slice().sort((a, b) => (a.startAt < b.startAt ? -1 : 1)));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : dictionary.events.genericLoadError);
    }
  }

  useEffect(() => {
    void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function openCreateForm(): void {
    setFormMode("create");
    setFormValues(emptyEventFormValues());
    setFormTargetSeriesId(null);
    setFormTargetOccurrenceDate(null);
    setFormExpectedUpdatedAt(null);
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm(): void {
    setFormOpen(false);
    setFormError(null);
  }

  async function beginEdit(occurrence: EventOccurrence, scope: EventEditScope | "PLAIN"): Promise<void> {
    if (!accessToken) return;
    setFormError(null);
    setFormTargetSeriesId(occurrence.seriesId);
    setFormTargetOccurrenceDate(occurrence.occurrenceDate);

    if (scope === "PLAIN" || scope === "SERIES") {
      if (occurrence.isRecurring) {
        try {
          const detail = await getEvent(occurrence.seriesId, accessToken);
          setFormValues(seriesDetailToFormValues(detail));
          setFormExpectedUpdatedAt(detail.updatedAt);
        } catch (err) {
          setLoadError(err instanceof Error ? err.message : dictionary.events.genericLoadError);
          return;
        }
      } else {
        setFormValues(occurrenceToFormValues(occurrence));
        setFormExpectedUpdatedAt(occurrence.seriesUpdatedAt);
      }
      setFormMode("series");
    } else if (scope === "OCCURRENCE") {
      setFormValues(occurrenceToFormValues(occurrence));
      setFormExpectedUpdatedAt(occurrence.isException ? occurrence.updatedAt : null);
      setFormMode("occurrence");
    } else {
      setFormValues(occurrenceToFormValues(occurrence));
      setFormExpectedUpdatedAt(occurrence.seriesUpdatedAt);
      setFormMode("future");
    }
    setFormOpen(true);
  }

  function startEdit(occurrence: EventOccurrence): void {
    if (occurrence.isRecurring) {
      setScopePrompt({ occurrence, action: "edit" });
    } else {
      void beginEdit(occurrence, "PLAIN");
    }
  }

  function startDelete(occurrence: EventOccurrence): void {
    if (occurrence.isRecurring) {
      setScopePrompt({ occurrence, action: "delete" });
    } else {
      setDeleteConfirm({ occurrence, scope: "SERIES" });
    }
  }

  function handleScopeConfirm(scope: EventEditScope): void {
    const prompt = scopePrompt;
    setScopePrompt(null);
    if (!prompt) return;
    if (prompt.action === "edit") {
      void beginEdit(prompt.occurrence, scope);
    } else {
      setDeleteConfirm({ occurrence: prompt.occurrence, scope });
    }
  }

  function describeError(err: unknown, fallback: string): string {
    if (err instanceof ApiError && err.response.code === "CONFLICT") {
      return dictionary.events.conflictError;
    }
    if (err instanceof ApiError && err.response.code === "VALIDATION_ERROR") {
      return dictionary.events.validationError;
    }
    return err instanceof Error ? err.message : fallback;
  }

  async function handleFormSubmit(): Promise<void> {
    if (!accessToken) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        await createEvent(formValuesToCreateRequest(formValues), accessToken);
      } else if (formTargetSeriesId && formMode === "series") {
        await updateEventSeries(
          formTargetSeriesId,
          formValuesToSeriesUpdateRequest(formValues, formExpectedUpdatedAt as string),
          accessToken,
        );
      } else if (formTargetSeriesId && formTargetOccurrenceDate && formMode === "occurrence") {
        await updateEventOccurrence(
          formTargetSeriesId,
          formTargetOccurrenceDate,
          formValuesToContentRequest(formValues, formExpectedUpdatedAt),
          accessToken,
        );
      } else if (formTargetSeriesId && formTargetOccurrenceDate && formMode === "future") {
        await updateEventSeriesFromOccurrence(
          formTargetSeriesId,
          formTargetOccurrenceDate,
          formValuesToContentRequest(formValues, formExpectedUpdatedAt as string),
          accessToken,
        );
      }
      closeForm();
      await loadEvents();
    } catch (err) {
      setFormError(describeError(err, dictionary.events.genericError));
    } finally {
      setFormSubmitting(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteConfirm || !accessToken) return;
    const { occurrence, scope } = deleteConfirm;
    try {
      if (scope === "SERIES") {
        await deleteEventSeries(occurrence.seriesId, { expectedUpdatedAt: occurrence.seriesUpdatedAt }, accessToken);
      } else if (scope === "OCCURRENCE") {
        await deleteEventOccurrence(
          occurrence.seriesId,
          occurrence.occurrenceDate,
          { expectedUpdatedAt: occurrence.isException ? occurrence.updatedAt : null },
          accessToken,
        );
      } else {
        await deleteEventSeriesFromOccurrence(
          occurrence.seriesId,
          occurrence.occurrenceDate,
          { expectedUpdatedAt: occurrence.seriesUpdatedAt },
          accessToken,
        );
      }
      setDeleteConfirm(null);
      await loadEvents();
    } catch (err) {
      setLoadError(describeError(err, dictionary.events.genericError));
      setDeleteConfirm(null);
    }
  }

  async function handleCoverUpload(seriesId: string, file: File): Promise<void> {
    if (!accessToken) return;
    setCoverBusySeriesId(seriesId);
    setCoverError(null);
    try {
      await uploadEventCover(seriesId, file, accessToken);
      await loadEvents();
    } catch (err) {
      setCoverError({ seriesId, message: describeError(err, dictionary.events.genericError) });
    } finally {
      setCoverBusySeriesId(null);
    }
  }

  async function handleCoverRemove(seriesId: string): Promise<void> {
    if (!accessToken) return;
    setCoverBusySeriesId(seriesId);
    setCoverError(null);
    try {
      await removeEventCover(seriesId, accessToken);
      await loadEvents();
    } catch (err) {
      setCoverError({ seriesId, message: describeError(err, dictionary.events.genericError) });
    } finally {
      setCoverBusySeriesId(null);
    }
  }

  const formTitle =
    formMode === "create"
      ? dictionary.events.newEvent
      : `${dictionary.events.edit}: ${occurrences?.find((o) => o.seriesId === formTargetSeriesId)?.titleEn ?? ""}`;
  const submitLabel = formMode === "create" ? dictionary.events.create : dictionary.events.save;
  const submittingLabel = formMode === "create" ? dictionary.events.creating : dictionary.events.saving;
  const allowRecurrenceEdit = formMode === "create" || formMode === "series";

  return (
    <div className="dho-stack">
      <Card>
        <div className="dho-page-header">
          <h1>{dictionary.events.title}</h1>
          <Button variant="accent" onClick={openCreateForm}>
            {dictionary.events.newEvent}
          </Button>
        </div>
        <p>{dictionary.events.publicNotice}</p>

        {loadError ? <p role="alert">{loadError}</p> : null}

        {!occurrences ? <p>{dictionary.common.loading}</p> : null}
        {occurrences && occurrences.length === 0 ? (
          <div className="dho-empty-state">
            <span className="dho-empty-state-icon" aria-hidden="true">
              🗓️
            </span>
            <p>{dictionary.events.noEvents}</p>
          </div>
        ) : null}

        {occurrences && occurrences.length > 0 ? (
          <div className="dho-stack">
            {occurrences.map((occurrence) => {
              const title = pickBilingual({ bg: occurrence.titleBg, en: occurrence.titleEn }, locale);
              const timeLabel = occurrence.isAllDay
                ? dictionary.calendar.allDay
                : `${formatEventTime(occurrence.startAt, locale)}–${formatEventTime(occurrence.endAt, locale)}`;

              return (
                <div key={`${occurrence.seriesId}-${occurrence.occurrenceDate}`} className="dho-cal-event-detail">
                  <EventCoverImage coverImagePath={occurrence.coverImagePath} alt={title} className="dho-cal-event-detail-cover" />
                  <div className="dho-stack" style={{ flex: 1, gap: "0.5rem" }}>
                    <div className="dho-cal-event-detail-heading">
                      <h3>{title}</h3>
                      {occurrence.isRecurring ? <Badge variant="muted">{dictionary.events.recurringBadge}</Badge> : null}
                    </div>
                    <p className="dho-cal-event-detail-meta">
                      {formatEventDate(occurrence.occurrenceDate, locale)} · {timeLabel} · {occurrence.location}
                    </p>
                    <div className="dho-row">
                      <Button variant="secondary" size="small" onClick={() => startEdit(occurrence)}>
                        {dictionary.events.edit}
                      </Button>
                      <Button variant="danger" size="small" onClick={() => startDelete(occurrence)}>
                        {dictionary.events.delete}
                      </Button>
                      <label className="dho-button dho-button--secondary dho-button--small" style={{ cursor: "pointer" }}>
                        {coverBusySeriesId === occurrence.seriesId
                          ? dictionary.events.uploading
                          : occurrence.coverImagePath
                            ? dictionary.events.replaceCover
                            : dictionary.events.uploadCover}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          style={{ display: "none" }}
                          disabled={coverBusySeriesId === occurrence.seriesId}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void handleCoverUpload(occurrence.seriesId, file);
                          }}
                        />
                      </label>
                      {occurrence.coverImagePath ? (
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={coverBusySeriesId === occurrence.seriesId}
                          onClick={() => void handleCoverRemove(occurrence.seriesId)}
                        >
                          {dictionary.events.removeCover}
                        </Button>
                      ) : null}
                    </div>
                    {coverError?.seriesId === occurrence.seriesId ? (
                      <p role="alert" className="dho-field-error">
                        {coverError.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      <EventFormModal
        open={formOpen}
        title={formTitle}
        submitLabel={submitLabel}
        submittingLabel={submittingLabel}
        submitting={formSubmitting}
        allowRecurrenceEdit={allowRecurrenceEdit}
        values={formValues}
        onChange={setFormValues}
        error={formError}
        onSubmit={() => void handleFormSubmit()}
        onCancel={closeForm}
      />

      <RecurrenceScopeDialog
        open={scopePrompt !== null}
        isDestructive={scopePrompt?.action === "delete"}
        onCancel={() => setScopePrompt(null)}
        onConfirm={handleScopeConfirm}
      />

      <Modal
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title={dictionary.events.confirmDeleteTitle}
        closeLabel={dictionary.common.close}
      >
        <div className="dho-modal-actions">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            {dictionary.events.cancel}
          </Button>
          <Button variant="danger" onClick={() => void confirmDelete()}>
            {dictionary.events.delete}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
