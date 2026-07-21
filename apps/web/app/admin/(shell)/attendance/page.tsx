"use client";

import { Badge, Button, Card, FormField, Modal } from "@dho/ui";
import type {
  AttendanceException,
  AttendanceStatus,
  MemberEffectiveAttendance,
  MemberSummary,
  Weekday,
} from "@dho/contracts";
import { WEEKDAYS_IN_ORDER } from "@dho/contracts";
import { useEffect, useState, type FormEvent } from "react";

import {
  ApiError,
  adminListMembers,
  deleteMemberAttendanceException,
  deleteOwnAttendanceException,
  getMemberEffectiveAttendance,
  getMemberWeeklySchedule,
  getOwnEffectiveAttendance,
  getOwnWeeklySchedule,
  updateMemberWeeklySchedule,
  updateOwnWeeklySchedule,
  upsertMemberAttendanceException,
  upsertOwnAttendanceException,
  listMemberAttendanceExceptions,
  listOwnAttendanceExceptions,
} from "../../../../lib/auth/api-client";
import { useAuth } from "../../../../lib/auth/auth-context";
import { defaultHorizonRange } from "../../../../lib/date-range";
import { useDictionary } from "../../../../lib/i18n/use-locale";

interface DayFormState {
  weekday: Weekday;
  attends: boolean;
  startTime: string;
  endTime: string;
  isInherited: boolean;
}

const EMPTY_EXCEPTION_FORM = { date: "", status: "ATTENDING" as AttendanceStatus, startTime: "", endTime: "" };

export default function AttendancePage() {
  const { user, accessToken } = useAuth();
  const dictionary = useDictionary();

  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [days, setDays] = useState<DayFormState[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [exceptions, setExceptions] = useState<AttendanceException[] | null>(null);
  const [effectiveByDate, setEffectiveByDate] = useState<Map<string, MemberEffectiveAttendance>>(new Map());
  const [exceptionsError, setExceptionsError] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [exceptionForm, setExceptionForm] = useState(EMPTY_EXCEPTION_FORM);
  const [creatingNew, setCreatingNew] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<AttendanceException | null>(null);

  useEffect(() => {
    if (user) {
      setSelectedUserId(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (!accessToken || user?.role !== "ADMIN") return;
    adminListMembers(accessToken)
      .then((result) => setMembers(result.members.filter((member) => member.isActive)))
      .catch(() => undefined);
  }, [accessToken, user?.role]);

  const isSelf = selectedUserId === user?.id;

  function loadWeekly(): void {
    if (!accessToken || !selectedUserId) return;
    const request = isSelf ? getOwnWeeklySchedule(accessToken) : getMemberWeeklySchedule(selectedUserId, accessToken);
    request
      .then((result) => {
        setDays(
          WEEKDAYS_IN_ORDER.map((weekday) => {
            const day = result.days.find((d) => d.weekday === weekday);
            return {
              weekday,
              attends: day?.attends ?? false,
              startTime: day?.startTime ?? "",
              endTime: day?.endTime ?? "",
              isInherited: day?.isInherited ?? true,
            };
          }),
        );
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : dictionary.attendancePage.genericLoadError));
  }

  function loadExceptions(): void {
    if (!accessToken || !selectedUserId) return;
    const range = defaultHorizonRange();
    const exceptionsRequest = isSelf
      ? listOwnAttendanceExceptions(range, accessToken)
      : listMemberAttendanceExceptions(selectedUserId, range, accessToken);
    const effectiveRequest = isSelf
      ? getOwnEffectiveAttendance(range, accessToken)
      : getMemberEffectiveAttendance(selectedUserId, range, accessToken);

    exceptionsRequest
      .then((result) => setExceptions(result.exceptions))
      .catch((err) =>
        setExceptionsError(err instanceof Error ? err.message : dictionary.attendancePage.genericLoadError),
      );
    effectiveRequest
      .then((result) => setEffectiveByDate(new Map(result.days.map((day) => [day.date, day]))))
      .catch(() => undefined);
  }

  useEffect(() => {
    setDays(null);
    setExceptions(null);
    loadWeekly();
    loadExceptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedUserId]);

  if (!user || !selectedUserId) {
    return null;
  }

  async function handleSaveWeekly(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!accessToken || !days || !selectedUserId) return;
    setSaveError(null);
    setSaveMessage(null);
    setSaving(true);
    try {
      const payload = {
        days: days.map((day) => ({
          weekday: day.weekday,
          attends: day.attends,
          startTime: day.attends ? day.startTime || null : null,
          endTime: day.attends ? day.endTime || null : null,
        })),
      };
      const updated = isSelf
        ? await updateOwnWeeklySchedule(payload, accessToken)
        : await updateMemberWeeklySchedule(selectedUserId, payload, accessToken);
      setDays(
        WEEKDAYS_IN_ORDER.map((weekday) => {
          const day = updated.days.find((d) => d.weekday === weekday);
          return {
            weekday,
            attends: day?.attends ?? false,
            startTime: day?.startTime ?? "",
            endTime: day?.endTime ?? "",
            isInherited: day?.isInherited ?? true,
          };
        }),
      );
      setSaveMessage(dictionary.attendancePage.saved);
    } catch (err) {
      if (err instanceof ApiError && err.response.code === "VALIDATION_ERROR") {
        setSaveError(dictionary.attendancePage.validationError);
      } else {
        setSaveError(err instanceof Error ? err.message : dictionary.attendancePage.genericError);
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

  function openEditExceptionModal(exception: AttendanceException): void {
    setExceptionForm({
      date: exception.date,
      status: exception.status,
      startTime: exception.startTime ?? "",
      endTime: exception.endTime ?? "",
    });
    setExceptionError(null);
    setEditingDate(exception.date);
  }

  async function handleSaveException(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!accessToken || !exceptionForm.date || !selectedUserId) return;
    setExceptionError(null);
    const hoursRequired = exceptionForm.status !== "NOT_ATTENDING";
    try {
      const payload = {
        status: exceptionForm.status,
        startTime: hoursRequired ? exceptionForm.startTime || null : null,
        endTime: hoursRequired ? exceptionForm.endTime || null : null,
      };
      if (isSelf) {
        await upsertOwnAttendanceException(exceptionForm.date, payload, accessToken);
      } else {
        await upsertMemberAttendanceException(selectedUserId, exceptionForm.date, payload, accessToken);
      }
      setCreatingNew(false);
      setEditingDate(null);
      loadExceptions();
    } catch (err) {
      if (err instanceof ApiError && err.response.code === "VALIDATION_ERROR") {
        setExceptionError(dictionary.attendancePage.validationError);
      } else {
        setExceptionError(err instanceof Error ? err.message : dictionary.attendancePage.genericError);
      }
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!accessToken || !confirmingDelete || !selectedUserId) return;
    try {
      if (isSelf) {
        await deleteOwnAttendanceException(confirmingDelete.date, accessToken);
      } else {
        await deleteMemberAttendanceException(selectedUserId, confirmingDelete.date, accessToken);
      }
      setConfirmingDelete(null);
      loadExceptions();
    } catch (err) {
      setExceptionsError(err instanceof Error ? err.message : dictionary.attendancePage.genericError);
    }
  }

  return (
    <>
      <Card>
        <h1>{dictionary.attendancePage.title}</h1>

        {user.role === "ADMIN" && members ? (
          <div className="dho-field">
            <label htmlFor="memberPicker">{dictionary.attendancePage.memberPicker}</label>
            <select
              id="memberPicker"
              className="dho-input"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                  {member.id === user.id ? ` (${dictionary.attendancePage.viewingOwnHint})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p>{dictionary.attendancePage.viewingOwnHint}</p>
        )}

        <h2>{dictionary.attendancePage.weeklyTitle}</h2>
        <p>{dictionary.attendancePage.weeklyHint}</p>

        {loadError ? <p role="alert">{loadError}</p> : null}

        {days ? (
          <form onSubmit={handleSaveWeekly}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }} />
                  <th style={{ textAlign: "left" }}>{dictionary.attendancePage.attends}</th>
                  <th style={{ textAlign: "left" }}>{dictionary.officeSettings.startTime}</th>
                  <th style={{ textAlign: "left" }}>{dictionary.officeSettings.endTime}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.weekday}>
                    <td>{dictionary.weekdays[day.weekday]}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${dictionary.weekdays[day.weekday]} ${dictionary.attendancePage.attends}`}
                        checked={day.attends}
                        onChange={(event) => updateDay(day.weekday, { attends: event.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="dho-input"
                        value={day.startTime}
                        disabled={!day.attends}
                        onChange={(event) => updateDay(day.weekday, { startTime: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="dho-input"
                        value={day.endTime}
                        disabled={!day.attends}
                        onChange={(event) => updateDay(day.weekday, { endTime: event.target.value })}
                      />
                    </td>
                    <td>
                      {day.isInherited ? (
                        <Badge variant="muted">{dictionary.attendancePage.inheritedBadge}</Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {saveMessage ? <p>{saveMessage}</p> : null}
            {saveError ? <p role="alert">{saveError}</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? dictionary.attendancePage.saving : dictionary.attendancePage.saveChanges}
            </Button>
          </form>
        ) : (
          <p>{dictionary.common.loading}</p>
        )}
      </Card>

      <Card style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>{dictionary.attendancePage.exceptionsTitle}</h2>
          <Button onClick={openNewExceptionModal}>{dictionary.attendancePage.newException}</Button>
        </div>
        <p>{dictionary.attendancePage.exceptionsHint}</p>

        {exceptionsError ? <p role="alert">{exceptionsError}</p> : null}
        {exceptions && exceptions.length === 0 ? <p>{dictionary.attendancePage.noExceptions}</p> : null}

        {exceptions && exceptions.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>{dictionary.attendancePage.date}</th>
                <th style={{ textAlign: "left" }}>{dictionary.attendancePage.status}</th>
                <th style={{ textAlign: "left" }}>{dictionary.attendancePage.hours}</th>
                <th style={{ textAlign: "left" }} />
                <th />
              </tr>
            </thead>
            <tbody>
              {exceptions.map((exception) => {
                const effective = effectiveByDate.get(exception.date);
                return (
                  <tr key={exception.date}>
                    <td>{exception.date}</td>
                    <td>{dictionary.attendanceStatus[exception.status]}</td>
                    <td>
                      {exception.startTime && exception.endTime
                        ? `${exception.startTime}–${exception.endTime}`
                        : "—"}
                    </td>
                    <td>
                      {effective && !effective.officeIsOpen ? (
                        <Badge variant="muted">{dictionary.attendancePage.officeClosedNotice}</Badge>
                      ) : effective?.isClamped ? (
                        <Badge variant="danger">
                          {effective.publicStartTime && effective.publicEndTime
                            ? dictionary.attendancePage.clampedBadge
                                .replace("{start}", effective.publicStartTime)
                                .replace("{end}", effective.publicEndTime)
                            : dictionary.attendancePage.clampedFullyOutside}
                        </Badge>
                      ) : null}
                    </td>
                    <td style={{ display: "flex", gap: "0.5rem" }}>
                      <Button variant="secondary" size="small" onClick={() => openEditExceptionModal(exception)}>
                        {dictionary.attendancePage.edit}
                      </Button>
                      <Button variant="danger" size="small" onClick={() => setConfirmingDelete(exception)}>
                        {dictionary.attendancePage.delete}
                      </Button>
                    </td>
                  </tr>
                );
              })}
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
        title={dictionary.attendancePage.newException}
      >
        <form onSubmit={handleSaveException}>
          <FormField
            label={dictionary.attendancePage.date}
            type="date"
            value={exceptionForm.date}
            onChange={(event) => setExceptionForm((prev) => ({ ...prev, date: event.target.value }))}
            disabled={editingDate !== null}
            required
          />
          <div className="dho-field">
            <label htmlFor="exceptionStatus">{dictionary.attendancePage.status}</label>
            <select
              id="exceptionStatus"
              className="dho-input"
              value={exceptionForm.status}
              onChange={(event) =>
                setExceptionForm((prev) => ({ ...prev, status: event.target.value as AttendanceStatus }))
              }
            >
              <option value="ATTENDING">{dictionary.attendanceStatus.ATTENDING}</option>
              <option value="NOT_SURE">{dictionary.attendanceStatus.NOT_SURE}</option>
              <option value="NOT_ATTENDING">{dictionary.attendanceStatus.NOT_ATTENDING}</option>
            </select>
          </div>
          <FormField
            label={dictionary.officeSettings.startTime}
            type="time"
            value={exceptionForm.startTime}
            disabled={exceptionForm.status === "NOT_ATTENDING"}
            onChange={(event) => setExceptionForm((prev) => ({ ...prev, startTime: event.target.value }))}
          />
          <FormField
            label={dictionary.officeSettings.endTime}
            type="time"
            value={exceptionForm.endTime}
            disabled={exceptionForm.status === "NOT_ATTENDING"}
            onChange={(event) => setExceptionForm((prev) => ({ ...prev, endTime: event.target.value }))}
          />
          {exceptionError ? <p role="alert">{exceptionError}</p> : null}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <Button type="submit">{dictionary.attendancePage.save}</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreatingNew(false);
                setEditingDate(null);
              }}
            >
              {dictionary.attendancePage.cancel}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmingDelete !== null}
        onClose={() => setConfirmingDelete(null)}
        title={dictionary.attendancePage.confirmDeleteTitle}
      >
        <p>{dictionary.attendancePage.confirmDeleteBody}</p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <Button variant="danger" onClick={() => void handleConfirmDelete()}>
            {dictionary.common.confirm}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingDelete(null)}>
            {dictionary.attendancePage.cancel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
