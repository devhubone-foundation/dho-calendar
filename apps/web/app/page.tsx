"use client";

import { Button, Card } from "@dho/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicCalendarResponse } from "@dho/contracts";

import { CalendarLegend } from "../components/calendar/CalendarLegend";
import { DayDetailsModal, type PublicDayInfo } from "../components/calendar/DayDetailsModal";
import { DayView } from "../components/calendar/DayView";
import { MonthView } from "../components/calendar/MonthView";
import { UpcomingView } from "../components/calendar/UpcomingView";
import { ViewSwitcher, type CalendarViewKind } from "../components/calendar/ViewSwitcher";
import { WeekView } from "../components/calendar/WeekView";
import {
  addDaysToKey,
  addMonthsToKey,
  getMonthGridDates,
  getWeekDates,
  todayKey,
  yearMonthOfKey,
} from "../lib/calendar-grid";
import { defaultHorizonRange } from "../lib/date-range";
import { formatEventDate, formatMonthLabel } from "../lib/event-format";
import { useIframeResize } from "../lib/iframe/resize";
import { LocaleSwitcher } from "../lib/i18n/LocaleSwitcher";
import { useDictionary, useLocale } from "../lib/i18n/use-locale";
import { getPublicCalendar } from "../lib/public-calendar/api-client";
import { useRealtimeInvalidation } from "../lib/realtime/socket-client";

// PRODUCT_BLUEPRINT.md §21.1/ARCHITECTURE.md §14: `?view=` accepts
// month|week|day|list — "list" maps onto the shared `CalendarViewKind`'s
// "upcoming" internal name (ViewSwitcher.tsx), which the rest of the
// calendar UI already uses. Missing/invalid values default to "week"
// (documented default per Issue #5).
const VIEW_PARAM_TO_KIND: Record<string, CalendarViewKind> = {
  month: "month",
  week: "week",
  day: "day",
  list: "upcoming",
};

function resolveView(value: string | null): CalendarViewKind {
  if (value && value in VIEW_PARAM_TO_KIND) {
    return VIEW_PARAM_TO_KIND[value] as CalendarViewKind;
  }
  return "week";
}

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

export default function PublicCalendarPage() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<CalendarViewKind>(() => resolveView(searchParams.get("view")));
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [calendarData, setCalendarData] = useState<PublicCalendarResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const handleInvalidate = useCallback(() => setRefreshTick((tick) => tick + 1), []);
  useRealtimeInvalidation(handleInvalidate);

  useEffect(() => {
    const range = visibleRangeFor(view, anchorDate);
    getPublicCalendar(range)
      .then((result) => {
        setCalendarData(result);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : dictionary.calendar.genericLoadError);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchorDate, refreshTick]);

  const occurrences = calendarData?.events ?? null;
  const selectedDay = calendarData?.days.find((day) => day.date === selectedDate);
  const publicDayInfo: PublicDayInfo | undefined = selectedDay
    ? {
        office: selectedDay.office,
        confirmedAttendees: selectedDay.confirmedAttendees,
        uncertainAttendees: selectedDay.uncertainAttendees,
      }
    : undefined;

  useIframeResize(containerRef, [view, anchorDate, modalOpen, calendarData]);

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

  const currentDay = calendarData?.days.find((day) => day.date === anchorDate);

  return (
    <div className="dho-public-page" ref={containerRef}>
      <header className="dho-public-topbar">
        <span className="dho-public-brand">{dictionary.nav.brandName}</span>
        <LocaleSwitcher />
      </header>

      <main className="dho-shell-main">
        <Card>
          <div className="dho-page-header">
            <div>
              <h1>{dictionary.publicPage.title}</h1>
              <p>{dictionary.publicPage.subtitle}</p>
            </div>
          </div>

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
              days={calendarData?.days}
              locale={locale}
              onSelectDate={openDayModal}
              onSwitchToUpcoming={() => setView("upcoming")}
            />
          ) : null}
          {occurrences && view === "week" ? (
            <WeekView
              anchorDateKey={anchorDate}
              occurrences={occurrences}
              days={calendarData?.days}
              locale={locale}
              onSelectDate={openDayModal}
            />
          ) : null}
          {occurrences && view === "day" ? (
            <DayView dateKey={anchorDate} occurrences={occurrences} day={currentDay} locale={locale} />
          ) : null}
          {occurrences && view === "upcoming" ? (
            <UpcomingView occurrences={occurrences} days={calendarData?.days} locale={locale} />
          ) : null}

          {occurrences && view !== "day" ? <CalendarLegend /> : null}
        </Card>
      </main>

      <DayDetailsModal
        open={modalOpen}
        dateKey={selectedDate}
        occurrences={occurrences ?? []}
        locale={locale}
        onClose={() => setModalOpen(false)}
        publicDayInfo={publicDayInfo}
      />
    </div>
  );
}
