"use client";

import { Button, Card, FormField, Modal } from "@dho/ui";
import type { OfficeScheduleException, Weekday } from "@dho/contracts";
import { WEEKDAYS_IN_ORDER } from "@dho/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  ApiError,
  deleteOfficeException,
  getOfficeDefaults,
  listOfficeExceptions,
  updateOfficeDefaults,
  upsertOfficeException,
} from "../../../../lib/auth/api-client";
import { useAuth } from "../../../../lib/auth/auth-context";
import { defaultHorizonRange } from "../../../../lib/date-range";
import { useDictionary } from "../../../../lib/i18n/use-locale";

interface DayFormState {
  weekday: Weekday;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

const EMPTY_EXCEPTION_FORM = { date: "", isOpen: false, startTime: "", endTime: "" };

export default function OfficeSettingsPage() {
  const { user, accessToken } = useAuth();
  const dictionary = useDictionary();
  const router = useRouter();

  const [days, setDays] = useState<DayFormState[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [exceptions, setExceptions] = useState<OfficeScheduleException[] | null>(null);
  const [exceptionsError, setExceptionsError] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [exceptionForm, setExceptionForm] = useState(EMPTY_EXCEPTION_FORM);
  const [creatingNew, setCreatingNew] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<OfficeScheduleException | null>(null);

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/admin");
    }
  }, [user, router]);

  useEffect(() => {
    if (!accessToken) return;
    getOfficeDefaults(accessToken)
      .then((result) => {
        setDays(
          WEEKDAYS_IN_ORDER.map((weekday) => {
            const day = result.days.find((d) => d.weekday === weekday);
            return {
              weekday,
              isOpen: day?.isOpen ?? false,
              startTime: day?.startTime ?? "",
              endTime: day?.endTime ?? "",
            };
          }),
        );
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : dictionary.officeSettings.genericLoadError));
  }, [accessToken, dictionary.officeSettings.genericLoadError]);

  function loadExceptions(): void {
    if (!accessToken) return;
    listOfficeExceptions(defaultHorizonRange(), accessToken)
      .then((result) => setExceptions(result.exceptions))
      .catch((err) =>
        setExceptionsError(err instanceof Error ? err.message : dictionary.officeSettings.genericLoadError),
      );
  }

  useEffect(loadExceptions, [accessToken, dictionary.officeSettings.genericLoadError]);

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  async function handleSaveDefaults(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!accessToken || !days) return;
    setSaveError(null);
    setSaveMessage(null);
    setSaving(true);
    try {
      const updated = await updateOfficeDefaults(
        {
          days: days.map((day) => ({
            weekday: day.weekday,
            isOpen: day.isOpen,
            startTime: day.isOpen ? day.startTime || null : null,
            endTime: day.isOpen ? day.endTime || null : null,
          })),
        },
        accessToken,
      );
      setDays(
        WEEKDAYS_IN_ORDER.map((weekday) => {
          const day = updated.days.find((d) => d.weekday === weekday);
          return {
            weekday,
            isOpen: day?.isOpen ?? false,
            startTime: day?.startTime ?? "",
            endTime: day?.endTime ?? "",
          };
        }),
      );
      setSaveMessage(dictionary.officeSettings.saved);
    } catch (err) {
      if (err instanceof ApiError && err.response.code === "VALIDATION_ERROR") {
        setSaveError(dictionary.officeSettings.validationError);
      } else {
        setSaveError(err instanceof Error ? err.message : dictionary.officeSettings.genericError);
      }
    } finally {
      setSaving(false);
    }
  }

  function updateDay(weekday: Weekday, patch: Partial<DayFormState>): void {
    setDays((prev) => prev?.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)) ?? prev);
  }

  function openNewExceptionModal(): void {
    setExceptionForm(EMPTY_EXCEPTION_FORM);
    setExceptionError(null);
    setCreatingNew(true);
  }

  function openEditExceptionModal(exception: OfficeScheduleException): void {
    setExceptionForm({
      date: exception.date,
      isOpen: exception.isOpen,
      startTime: exception.startTime ?? "",
      endTime: exception.endTime ?? "",
    });
    setExceptionError(null);
    setEditingDate(exception.date);
  }

  async function handleSaveException(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!accessToken || !exceptionForm.date) return;
    setExceptionError(null);
    try {
      await upsertOfficeException(
        exceptionForm.date,
        {
          isOpen: exceptionForm.isOpen,
          startTime: exceptionForm.isOpen ? exceptionForm.startTime || null : null,
          endTime: exceptionForm.isOpen ? exceptionForm.endTime || null : null,
        },
        accessToken,
      );
      setCreatingNew(false);
      setEditingDate(null);
      loadExceptions();
    } catch (err) {
      if (err instanceof ApiError && err.response.code === "VALIDATION_ERROR") {
        setExceptionError(dictionary.officeSettings.validationError);
      } else {
        setExceptionError(err instanceof Error ? err.message : dictionary.officeSettings.genericError);
      }
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!accessToken || !confirmingDelete) return;
    try {
      await deleteOfficeException(confirmingDelete.date, accessToken);
      setConfirmingDelete(null);
      loadExceptions();
    } catch (err) {
      setExceptionsError(err instanceof Error ? err.message : dictionary.officeSettings.genericError);
    }
  }

  return (
    <>
      <Card>
        <h1>{dictionary.officeSettings.title}</h1>
        <h2>{dictionary.officeSettings.weeklyDefaultsTitle}</h2>
        <p>{dictionary.officeSettings.weeklyDefaultsHint}</p>

        {loadError ? <p role="alert">{loadError}</p> : null}

        {days ? (
          <form onSubmit={handleSaveDefaults}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }} />
                  <th style={{ textAlign: "left" }}>{dictionary.officeSettings.open}</th>
                  <th style={{ textAlign: "left" }}>{dictionary.officeSettings.startTime}</th>
                  <th style={{ textAlign: "left" }}>{dictionary.officeSettings.endTime}</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.weekday}>
                    <td>{dictionary.weekdays[day.weekday]}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${dictionary.weekdays[day.weekday]} ${dictionary.officeSettings.open}`}
                        checked={day.isOpen}
                        onChange={(event) => updateDay(day.weekday, { isOpen: event.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="dho-input"
                        aria-label={`${dictionary.weekdays[day.weekday]} ${dictionary.officeSettings.startTime}`}
                        value={day.startTime}
                        disabled={!day.isOpen}
                        onChange={(event) => updateDay(day.weekday, { startTime: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="dho-input"
                        aria-label={`${dictionary.weekdays[day.weekday]} ${dictionary.officeSettings.endTime}`}
                        value={day.endTime}
                        disabled={!day.isOpen}
                        onChange={(event) => updateDay(day.weekday, { endTime: event.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {saveMessage ? <p>{saveMessage}</p> : null}
            {saveError ? <p role="alert">{saveError}</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? dictionary.officeSettings.saving : dictionary.officeSettings.saveChanges}
            </Button>
          </form>
        ) : (
          <p>{dictionary.common.loading}</p>
        )}
      </Card>

      <Card style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>{dictionary.officeSettings.exceptionsTitle}</h2>
          <Button onClick={openNewExceptionModal}>{dictionary.officeSettings.newException}</Button>
        </div>
        <p>{dictionary.officeSettings.exceptionsHint}</p>

        {exceptionsError ? <p role="alert">{exceptionsError}</p> : null}

        {exceptions && exceptions.length === 0 ? <p>{dictionary.officeSettings.noExceptions}</p> : null}

        {exceptions && exceptions.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>{dictionary.officeSettings.date}</th>
                <th style={{ textAlign: "left" }}>{dictionary.officeSettings.open}</th>
                <th style={{ textAlign: "left" }}>{dictionary.officeSettings.hours}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {exceptions.map((exception) => (
                <tr key={exception.date}>
                  <td>{exception.date}</td>
                  <td>{exception.isOpen ? dictionary.officeSettings.open : dictionary.officeSettings.closed}</td>
                  <td>
                    {exception.isOpen && exception.startTime && exception.endTime
                      ? `${exception.startTime}–${exception.endTime}`
                      : "—"}
                  </td>
                  <td style={{ display: "flex", gap: "0.5rem" }}>
                    <Button variant="secondary" size="small" onClick={() => openEditExceptionModal(exception)}>
                      {dictionary.officeSettings.edit}
                    </Button>
                    <Button variant="danger" size="small" onClick={() => setConfirmingDelete(exception)}>
                      {dictionary.officeSettings.delete}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Card>

      <Modal
        open={creatingNew || editingDate !== null}
        onClose={() => {
          setCreatingNew(false);
          setEditingDate(null);
        }}
        title={dictionary.officeSettings.newException}
      >
        <form onSubmit={handleSaveException}>
          <FormField
            label={dictionary.officeSettings.date}
            type="date"
            value={exceptionForm.date}
            onChange={(event) => setExceptionForm((prev) => ({ ...prev, date: event.target.value }))}
            disabled={editingDate !== null}
            required
          />
          <div className="dho-field">
            <label htmlFor="exceptionIsOpen">{dictionary.officeSettings.open}</label>
            <input
              id="exceptionIsOpen"
              type="checkbox"
              checked={exceptionForm.isOpen}
              onChange={(event) => setExceptionForm((prev) => ({ ...prev, isOpen: event.target.checked }))}
            />
          </div>
          <FormField
            label={dictionary.officeSettings.startTime}
            type="time"
            value={exceptionForm.startTime}
            disabled={!exceptionForm.isOpen}
            onChange={(event) => setExceptionForm((prev) => ({ ...prev, startTime: event.target.value }))}
          />
          <FormField
            label={dictionary.officeSettings.endTime}
            type="time"
            value={exceptionForm.endTime}
            disabled={!exceptionForm.isOpen}
            onChange={(event) => setExceptionForm((prev) => ({ ...prev, endTime: event.target.value }))}
          />
          {exceptionError ? <p role="alert">{exceptionError}</p> : null}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <Button type="submit">{dictionary.officeSettings.save}</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreatingNew(false);
                setEditingDate(null);
              }}
            >
              {dictionary.officeSettings.cancel}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmingDelete !== null}
        onClose={() => setConfirmingDelete(null)}
        title={dictionary.officeSettings.confirmDeleteTitle}
      >
        <p>{dictionary.officeSettings.confirmDeleteBody}</p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <Button variant="danger" onClick={() => void handleConfirmDelete()}>
            {dictionary.common.confirm}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingDelete(null)}>
            {dictionary.officeSettings.cancel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
