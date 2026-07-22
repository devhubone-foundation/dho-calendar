"use client";

import { Button, Card } from "@dho/ui";
import type { EventOccurrence } from "@dho/contracts";
import { useCallback, useEffect, useState } from "react";

import { getOfficeEffectiveRange, listEvents } from "../../../../lib/auth/api-client";
import { useAuth } from "../../../../lib/auth/auth-context";
import { defaultHorizonRange } from "../../../../lib/date-range";
import {
  addDaysToKey,
  addMonthsToKey,
  getMonthGridDates,
  getWeekDates,
  todayKey,
  yearMonthOfKey,
} from "../../../../lib/calendar-grid";
import { formatEventDate, formatMonthLabel } from "../../../../lib/event-format";
import { useDictionary, useLocale } from "../../../../lib/i18n/use-locale";
import { useRealtimeInvalidation } from "../../../../lib/realtime/socket-client";
import { DayDetailsModal } from "../../../../components/calendar/DayDetailsModal";
import { DayView } from "../../../../components/calendar/DayView";
import { MonthView } from "../../../../components/calendar/MonthView";
import { UpcomingView } from "../../../../components/calendar/UpcomingView";
import { ViewSwitcher, type CalendarViewKind } from "../../../../components/calendar/ViewSwitcher";
import { WeekView } from "../../../../components/calendar/WeekView";

function visibleRangeFor(view: CalendarViewKind, anchorDate: string): { from: string; to: string } {
  if (view === "month") {
    const { year, month } = yearMonthOfKey(anchorDate);
    const dates = getMonthGridDates(year, month);
    return { from: dates[0] as string, to: dates[dates.length - 1] as string };
  }
  if (view === "week") {
    const dates = getWeekDates(anchorDate);
    return { from: dates[0] as string, to: dates[6] as string };
  }
  if (view === "day") {
    return { from: anchorDate, to: anchorDate };
  }
  return defaultHorizonRange();
}

export default function CalendarPage() {
  const { accessToken } = useAuth();
  const dictionary = useDictionary();
  const locale = useLocale();

  const [view, setView] = useState<CalendarViewKind>("month");
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [occurrences, setOccurrences] = useState<EventOccurrence[] | null>(null);
  const [officeOpenDates, setOfficeOpenDates] = useState<Set<string> | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const handleInvalidate = useCallback(() => setRefreshTick((tick) => tick + 1), []);
  useRealtimeInvalidation(handleInvalidate);

  useEffect(() => {
    if (!accessToken) return;
    const range = visibleRangeFor(view, anchorDate);

    listEvents(range, accessToken)
      .then((result) => {
        setOccurrences(result.occurrences);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : dictionary.calendar.genericLoadError);
      });

    if (view === "month") {
      getOfficeEffectiveRange(range, accessToken)
        .then((result) => setOfficeOpenDates(new Set(result.days.filter((day) => day.isOpen).map((day) => day.date))))
        // Non-critical augmentation (PRODUCT_BLUEPRINT.md §15.1 "open-office
        // days"); a failure here should not block the events-first calendar.
        .catch(() => setOfficeOpenDates(undefined));
    } else {
      setOfficeOpenDates(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, view, anchorDate, refreshTick]);

  function openDayModal(dateKey: string): void {
    setSelectedDate(dateKey);
    setModalOpen(true);
  }

  function goToday(): void {
    setAnchorDate(todayKey());
  }

  function goPrevious(): void {
    if (view === "month") setAnchorDate(addMonthsToKey(anchorDate, -1));
    else if (view === "week") setAnchorDate(addDaysToKey(anchorDate, -7));
    else if (view === "day") setAnchorDate(addDaysToKey(anchorDate, -1));
  }

  function goNext(): void {
    if (view === "month") setAnchorDate(addMonthsToKey(anchorDate, 1));
    else if (view === "week") setAnchorDate(addDaysToKey(anchorDate, 7));
    else if (view === "day") setAnchorDate(addDaysToKey(anchorDate, 1));
  }

  const { year, month } = yearMonthOfKey(anchorDate);
  const weekDates = getWeekDates(anchorDate);
  const headerLabel =
    view === "month"
      ? formatMonthLabel(year, month, locale)
      : view === "week"
        ? `${formatEventDate(weekDates[0] as string, locale)} – ${formatEventDate(weekDates[6] as string, locale)}`
        : view === "day"
          ? formatEventDate(anchorDate, locale)
          : null;

  return (
    <>
      <Card>
        <h1>{dictionary.calendar.title}</h1>
        <ViewSwitcher view={view} onChange={setView} />

        {view !== "upcoming" ? (
          <div className="dho-cal-nav-row">
            <Button variant="secondary" size="small" onClick={goPrevious}>
              {dictionary.calendar.previous}
            </Button>
            <Button variant="secondary" size="small" onClick={goToday}>
              {dictionary.calendar.today}
            </Button>
            <Button variant="secondary" size="small" onClick={goNext}>
              {dictionary.calendar.next}
            </Button>
            <strong>{headerLabel}</strong>
          </div>
        ) : null}

        {loadError ? <p role="alert">{loadError}</p> : null}
        {!occurrences ? <p>{dictionary.common.loading}</p> : null}

        {occurrences && view === "month" ? (
          <MonthView
            year={year}
            month={month}
            occurrences={occurrences}
            officeOpenDates={officeOpenDates}
            locale={locale}
            onSelectDate={openDayModal}
          />
        ) : null}
        {occurrences && view === "week" ? (
          <WeekView anchorDateKey={anchorDate} occurrences={occurrences} locale={locale} onSelectDate={openDayModal} />
        ) : null}
        {occurrences && view === "day" ? <DayView dateKey={anchorDate} occurrences={occurrences} locale={locale} /> : null}
        {occurrences && view === "upcoming" ? <UpcomingView occurrences={occurrences} locale={locale} /> : null}
      </Card>

      <DayDetailsModal
        open={modalOpen}
        dateKey={selectedDate}
        occurrences={occurrences ?? []}
        locale={locale}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
