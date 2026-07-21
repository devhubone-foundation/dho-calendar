/** Pure "YYYY-MM-DD" calendar-grid math for the Month/Week views and for
 * grouping event occurrences onto the visible dates. No timezone conversion
 * here — see lib/event-format.ts for locale/timezone-aware display strings. */

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addDaysToKey(dateKey: string, amount: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDateKey(date);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addMonthsToKey(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  return toDateKey(new Date(Date.UTC(year, month - 1 + amount, day)));
}

/** Splits "YYYY-MM-DD" into a `{ year, month }` pair with `month` 0-indexed,
 * ready for `getMonthGridDates`/`Date#getUTCMonth()`. */
export function yearMonthOfKey(dateKey: string): { year: number; month: number } {
  const [year, month] = dateKey.split("-").map(Number) as [number, number];
  return { year, month: month - 1 };
}

/** The Monday on or before `dateKey` (Monday-first week, matching
 * WEEKDAYS_IN_ORDER across the rest of the app). */
export function mondayOnOrBefore(dateKey: string): string {
  const jsDay = parseDateKey(dateKey).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (jsDay + 6) % 7;
  return addDaysToKey(dateKey, -daysSinceMonday);
}

/** All dates for the Week view containing `dateKey`, Monday through Sunday. */
export function getWeekDates(dateKey: string): string[] {
  const monday = mondayOnOrBefore(dateKey);
  return Array.from({ length: 7 }, (_, index) => addDaysToKey(monday, index));
}

/** All dates for the Month view's grid containing `year`/`month` (0-indexed,
 * matching `Date`), padded to whole weeks with the leading/trailing days of
 * the adjacent months so the grid is always a rectangle of weeks. */
export function getMonthGridDates(year: number, month: number): string[] {
  const firstOfMonth = toDateKey(new Date(Date.UTC(year, month, 1)));
  const lastOfMonth = toDateKey(new Date(Date.UTC(year, month + 1, 0)));
  const gridStart = mondayOnOrBefore(firstOfMonth);
  const gridEnd = addDaysToKey(mondayOnOrBefore(lastOfMonth), 6);

  const dates: string[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDaysToKey(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export interface OccurrenceLike {
  startAt: string;
  endAt: string;
  isAllDay: boolean;
}

/** The inclusive [start, end] calendar-date keys an occurrence visibly
 * covers. For an all-day event `endAt` is the exclusive midnight of the day
 * after the last day, so the covered end is one instant earlier — mirrors
 * apps/api/src/events/events.recurrence.ts `coveredEndDateKey`. */
export function occurrenceDateSpan(occurrence: OccurrenceLike): { startKey: string; endKey: string } {
  const startKey = occurrence.startAt.slice(0, 10);
  const endInstant = occurrence.isAllDay
    ? new Date(new Date(occurrence.endAt).getTime() - 1)
    : new Date(occurrence.endAt);
  return { startKey, endKey: toDateKey(endInstant) };
}

/** Groups occurrences onto every visible date they cover (not just their
 * `occurrenceDate` anchor), so a multi-day event renders on each day it
 * spans. Only dates in `visibleDateKeys` are populated/returned. */
export function groupOccurrencesByDate<T extends OccurrenceLike>(
  occurrences: T[],
  visibleDateKeys: string[],
): Map<string, T[]> {
  const map = new Map<string, T[]>(visibleDateKeys.map((key) => [key, []]));
  if (visibleDateKeys.length === 0) {
    return map;
  }

  const firstVisible = visibleDateKeys[0] as string;
  const lastVisible = visibleDateKeys[visibleDateKeys.length - 1] as string;

  for (const occurrence of occurrences) {
    const { startKey, endKey } = occurrenceDateSpan(occurrence);
    const from = startKey < firstVisible ? firstVisible : startKey;
    const to = endKey > lastVisible ? lastVisible : endKey;
    for (let cursor = from; cursor <= to; cursor = addDaysToKey(cursor, 1)) {
      map.get(cursor)?.push(occurrence);
    }
  }
  return map;
}
