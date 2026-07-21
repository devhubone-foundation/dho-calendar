import type { Locale } from "@dho/ui";

/** ARCHITECTURE.md §23: Version 1 supports exactly one office location,
 * Sofia, Bulgaria — display formatting always renders event times in this
 * timezone, matching the backend's OFFICE_TIMEZONE default. */
export const OFFICE_DISPLAY_TIMEZONE = "Europe/Sofia";

function intlLocale(locale: Locale): string {
  return locale === "bg" ? "bg-BG" : "en-GB";
}

/** "HH:mm" in the office timezone, e.g. "14:00". */
export function formatEventTime(isoInstant: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: OFFICE_DISPLAY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoInstant));
}

/** A short human date label, e.g. "3 Aug 2026" / "3 авг 2026". */
export function formatEventDate(isoInstantOrDateKey: string, locale: Locale): string {
  const date = isoInstantOrDateKey.length === 10 ? `${isoInstantOrDateKey}T00:00:00.000Z` : isoInstantOrDateKey;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: OFFICE_DISPLAY_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/** A short weekday + day label for grid headers, e.g. "Mon 3". */
export function formatWeekdayAndDay(dateKey: string, locale: Locale): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const weekday = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: OFFICE_DISPLAY_TIMEZONE,
    weekday: "short",
  }).format(date);
  const day = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: OFFICE_DISPLAY_TIMEZONE,
    day: "numeric",
  }).format(date);
  return `${weekday} ${day}`;
}

/** A month + year label for the Month view header, e.g. "August 2026". */
export function formatMonthLabel(year: number, month: number, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: OFFICE_DISPLAY_TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month, 1)));
}
