"use client";

import { Badge, Button, Card } from "@dho/ui";
import type {
  AttendanceExceptionInput,
  MemberEffectiveAttendance,
  MemberSummary,
  MemberWeeklyScheduleDay,
  OfficeEffectiveDay,
  WeeklyScheduleDayInput,
} from "@dho/contracts";
import { useEffect, useState } from "react";

import {
  adminListMembers,
  deleteMemberAttendanceException,
  deleteOwnAttendanceException,
  getMemberEffectiveAttendance,
  getMemberWeeklySchedule,
  getOfficeEffectiveRange,
  getOwnEffectiveAttendance,
  getOwnWeeklySchedule,
  updateMemberWeeklySchedule,
  updateOwnWeeklySchedule,
  upsertMemberAttendanceException,
  upsertOwnAttendanceException,
} from "../../../../lib/auth/api-client";
import { useAuth } from "../../../../lib/auth/auth-context";
import { addDaysToKey, todayKey } from "../../../../lib/calendar-grid";
import { formatEventDate, formatFullWeekday } from "../../../../lib/event-format";
import { useDictionary, useLocale } from "../../../../lib/i18n/use-locale";
import { DailyAttendanceModal } from "../../../../components/attendance/DailyAttendanceModal";
import { WeeklyScheduleModal } from "../../../../components/attendance/WeeklyScheduleModal";

export default function AttendancePage() {
  const { user, accessToken } = useAuth();
  const dictionary = useDictionary();
  const locale = useLocale();

  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => todayKey());

  const [effective, setEffective] = useState<MemberEffectiveAttendance | null>(null);
  const [officeDay, setOfficeDay] = useState<OfficeEffectiveDay | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [weeklyDays, setWeeklyDays] = useState<MemberWeeklyScheduleDay[] | null>(null);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [weeklyModalOpen, setWeeklyModalOpen] = useState(false);

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

  function loadDay(): void {
    if (!accessToken || !selectedUserId) return;
    const range = { from: selectedDate, to: selectedDate };
    const effectiveRequest = isSelf
      ? getOwnEffectiveAttendance(range, accessToken)
      : getMemberEffectiveAttendance(selectedUserId, range, accessToken);

    effectiveRequest
      .then((result) => setEffective(result.days[0] ?? null))
      .catch((err) => setLoadError(err instanceof Error ? err.message : dictionary.attendancePage.genericLoadError));

    getOfficeEffectiveRange(range, accessToken)
      .then((result) => setOfficeDay(result.days[0] ?? null))
      .catch(() => undefined);
  }

  function loadWeekly(): void {
    if (!accessToken || !selectedUserId) return;
    const request = isSelf ? getOwnWeeklySchedule(accessToken) : getMemberWeeklySchedule(selectedUserId, accessToken);
    request
      .then((result) => setWeeklyDays(result.days))
      .catch((err) => setWeeklyError(err instanceof Error ? err.message : dictionary.attendancePage.genericLoadError));
  }

  useEffect(() => {
    setEffective(null);
    setOfficeDay(null);
    setLoadError(null);
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedUserId, selectedDate]);

  useEffect(() => {
    setWeeklyDays(null);
    setWeeklyError(null);
    loadWeekly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedUserId]);

  if (!user || !selectedUserId) {
    return null;
  }

  async function handleSaveDaily(input: AttendanceExceptionInput): Promise<void> {
    if (!accessToken || !selectedUserId) return;
    if (isSelf) {
      await upsertOwnAttendanceException(selectedDate, input, accessToken);
    } else {
      await upsertMemberAttendanceException(selectedUserId, selectedDate, input, accessToken);
    }
    setDailyModalOpen(false);
    loadDay();
  }

  async function handleResetToDefault(): Promise<void> {
    if (!accessToken || !selectedUserId) return;
    if (isSelf) {
      await deleteOwnAttendanceException(selectedDate, accessToken);
    } else {
      await deleteMemberAttendanceException(selectedUserId, selectedDate, accessToken);
    }
    setDailyModalOpen(false);
    loadDay();
  }

  async function handleSaveWeekly(days: WeeklyScheduleDayInput[]): Promise<void> {
    if (!accessToken || !selectedUserId) return;
    const payload = { days };
    if (isSelf) {
      await updateOwnWeeklySchedule(payload, accessToken);
    } else {
      await updateMemberWeeklySchedule(selectedUserId, payload, accessToken);
    }
    setWeeklyModalOpen(false);
    loadWeekly();
    loadDay();
  }

  const officeIsOpen = officeDay?.isOpen ?? false;
  // PRODUCT_BLUEPRINT.md §12.8/§13: confirmed attendance on an otherwise-closed
  // date opens the Hub for that date, so the office view treats it as open too.
  const opensClosedDay =
    !officeIsOpen && effective !== null && effective.status === "ATTENDING" && effective.publicSlots.length > 0;
  const isEffectivelyOpen = officeIsOpen || opensClosedDay;
  const statusHeadline = !isEffectivelyOpen
    ? dictionary.attendancePage.dayStatusOfficeClosed
    : effective
      ? dictionary.attendancePage.dayStatus[effective.status]
      : "";
  const showConflictNote = !officeIsOpen && !opensClosedDay && effective !== null && effective.status !== "NOT_ATTENDING";
  const showOpensHubNote = opensClosedDay;
  const showSlots =
    isEffectivelyOpen && effective !== null && effective.status !== "NOT_ATTENDING" && effective.enteredSlots.length > 0;
  const dateLabel = `${formatFullWeekday(selectedDate, locale)}, ${formatEventDate(selectedDate, locale)}`;

  return (
    <div className="dho-stack">
      <Card>
        <div className="dho-attday-nav">
          <Button
            variant="secondary"
            size="small"
            aria-label={dictionary.attendancePage.previousDay}
            onClick={() => setSelectedDate((current) => addDaysToKey(current, -1))}
          >
            ‹
          </Button>
          <div className="dho-attday-heading">
            <h1>{formatFullWeekday(selectedDate, locale)}</h1>
            <p className="dho-attday-date">{formatEventDate(selectedDate, locale)}</p>
          </div>
          <Button
            variant="secondary"
            size="small"
            aria-label={dictionary.attendancePage.nextDay}
            onClick={() => setSelectedDate((current) => addDaysToKey(current, 1))}
          >
            ›
          </Button>
        </div>

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

        {loadError ? <p role="alert">{loadError}</p> : null}

        {effective && officeDay ? (
          <div className="dho-attday-status">
            <p className="dho-attday-status-headline">
              {statusHeadline}
              {officeDay.source === "EXCEPTION" ? (
                <Badge variant="muted">{dictionary.calendar.officeHoursChanged}</Badge>
              ) : null}
            </p>

            {showSlots ? (
              <ul className="dho-attday-slots">
                {effective.enteredSlots.map((slot, index) => (
                  <li key={index}>
                    {slot.startTime}–{slot.endTime}
                  </li>
                ))}
              </ul>
            ) : null}

            {showConflictNote ? (
              <p className="dho-attday-conflict">{dictionary.attendancePage.officeClosedNotice}</p>
            ) : null}

            {showOpensHubNote ? (
              <p className="dho-attday-opens-hub">{dictionary.attendancePage.attendanceOpensClosedDayNotice}</p>
            ) : null}

            {officeIsOpen && officeDay.startTime && officeDay.endTime ? (
              <p className="dho-attday-officehours">
                {dictionary.attendancePage.officeHoursLabel
                  .replace("{start}", officeDay.startTime)
                  .replace("{end}", officeDay.endTime)}
              </p>
            ) : null}

            <Button variant="accent" onClick={() => setDailyModalOpen(true)} style={{ alignSelf: "flex-start" }}>
              {dictionary.attendancePage.editThisDay}
            </Button>
          </div>
        ) : (
          <p>{dictionary.common.loading}</p>
        )}
      </Card>

      <Card>
        <div className="dho-page-header">
          <h2>{dictionary.attendancePage.weeklyTitle}</h2>
          <Button variant="secondary" onClick={() => setWeeklyModalOpen(true)}>
            {dictionary.attendancePage.weeklyModalButton}
          </Button>
        </div>
        <p>{dictionary.attendancePage.weeklyHint}</p>
        {weeklyError ? <p role="alert">{weeklyError}</p> : null}
      </Card>

      {effective ? (
        <DailyAttendanceModal
          open={dailyModalOpen}
          dateLabel={dateLabel}
          status={effective.status}
          slots={effective.enteredSlots}
          isCustomized={effective.isCustomized}
          onClose={() => setDailyModalOpen(false)}
          onSave={handleSaveDaily}
          onResetToDefault={handleResetToDefault}
        />
      ) : null}

      {weeklyDays ? (
        <WeeklyScheduleModal
          open={weeklyModalOpen}
          days={weeklyDays}
          onClose={() => setWeeklyModalOpen(false)}
          onSave={handleSaveWeekly}
        />
      ) : null}
    </div>
  );
}
