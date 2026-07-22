"use client";

import { Button, Card } from "@dho/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicCalendarResponse } from "@dho/contracts";

import { AttendanceTimelineView } from "../components/calendar/AttendanceTimelineView";
import { DayDetailsModal } from "../components/calendar/DayDetailsModal";
import { MonthView } from "../components/calendar/MonthView";
import { addDaysToKey, addMonthsToKey, getMonthGridDates, todayKey, yearMonthOfKey } from "../lib/calendar-grid";
import { formatMonthLabel } from "../lib/event-format";
import { useIframeResize } from "../lib/iframe/resize";
import { LocaleSwitcher } from "../lib/i18n/LocaleSwitcher";
import { useDictionary, useLocale } from "../lib/i18n/use-locale";
import { getPublicCalendar } from "../lib/public-calendar/api-client";
import { useRealtimeInvalidation } from "../lib/realtime/socket-client";

/**
 * PRODUCT_BLUEPRINT.md §15.1 (v1.1): the public calendar has exactly two
 * views, selected only through `?view=`. There is no visible switcher —
 * embedding sites pick the view by iframe URL. Invalid/missing values fall
 * back to "attendance".
 */
type PublicView = "attendance" | "events";

function resolveView(value: string | null): PublicView {
  return value === "events" ? "events" : "attendance";
}

/** Next 7 days starting today (never past days) — §15.1.1. */
function nextSevenDayRange(): { from: string; to: string } {
  const from = todayKey();
  return { from, to: addDaysToKey(from, 6) };
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PublicCalendarPage() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const view = resolveView(searchParams.get("view"));
  const [monthAnchor, setMonthAnchor] = useState(todayKey());
  const [calendarData, setCalendarData] = useState<PublicCalendarResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const handleInvalidate = useCallback(() => setRefreshTick((tick) => tick + 1), []);
  useRealtimeInvalidation(handleInvalidate);

  const { year, month } = yearMonthOfKey(monthAnchor);
  const range =
    view === "attendance"
      ? nextSevenDayRange()
      : (() => {
          const dates = getMonthGridDates(year, month);
          return { from: dates[0] as string, to: dates[dates.length - 1] as string };
        })();

  useEffect(() => {
    getPublicCalendar(range)
      .then((result) => {
        setCalendarData(result);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : dictionary.calendar.genericLoadError);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, range.from, range.to, refreshTick]);

  const occurrences = calendarData?.events ?? null;

  useIframeResize(containerRef, [view, monthAnchor, modalOpen, calendarData]);

  function openDayModal(dateKey: string): void {
    setSelectedDate(dateKey);
    setModalOpen(true);
  }

  const heading =
    view === "attendance"
      ? { title: dictionary.calendar.attendanceViewTitle, subtitle: dictionary.calendar.attendanceViewSubtitle }
      : { title: dictionary.calendar.eventsViewTitle, subtitle: dictionary.publicPage.subtitle };

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
              <h1>{heading.title}</h1>
              <p>{heading.subtitle}</p>
            </div>
          </div>

          {view === "events" ? (
            <div className="dho-cal-month-nav-row">
              <Button
                variant="secondary"
                size="small"
                className="dho-cal-icon-button"
                aria-label={dictionary.calendar.previous}
                onClick={() => setMonthAnchor((anchor) => addMonthsToKey(anchor, -1))}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="dho-cal-month-nav-label">{formatMonthLabel(year, month, locale)}</span>
              <Button
                variant="secondary"
                size="small"
                className="dho-cal-icon-button"
                aria-label={dictionary.calendar.next}
                onClick={() => setMonthAnchor((anchor) => addMonthsToKey(anchor, 1))}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          ) : null}

          {loadError ? <p role="alert">{loadError}</p> : null}
          {!calendarData ? <p>{dictionary.common.loading}</p> : null}

          {calendarData && view === "attendance" ? (
            <AttendanceTimelineView days={calendarData.days} locale={locale} />
          ) : null}

          {occurrences && view === "events" ? (
            <MonthView year={year} month={month} occurrences={occurrences} locale={locale} onSelectDate={openDayModal} />
          ) : null}
        </Card>
      </main>

      {view === "events" ? (
        <DayDetailsModal
          open={modalOpen}
          dateKey={selectedDate}
          occurrences={occurrences ?? []}
          locale={locale}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
