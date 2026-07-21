import type {
  CreateEventRequest,
  EventOccurrence,
  EventRecurrenceInput,
  EventSeriesDetail,
  UpdateEventSeriesRequest,
  Weekday,
} from "@dho/contracts";

export interface EventFormValues {
  titleBg: string;
  titleEn: string;
  descriptionBg: string;
  descriptionEn: string;
  /** "YYYY-MM-DDTHH:mm" when timed, "YYYY-MM-DD" when all-day. */
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  location: string;
  recurrenceEnabled: boolean;
  byWeekdays: Weekday[];
  endType: "COUNT" | "UNTIL";
  count: string;
  until: string;
}

export function emptyEventFormValues(): EventFormValues {
  return {
    titleBg: "",
    titleEn: "",
    descriptionBg: "",
    descriptionEn: "",
    startAt: "",
    endAt: "",
    isAllDay: false,
    location: "",
    recurrenceEnabled: false,
    byWeekdays: [],
    endType: "COUNT",
    count: "4",
    until: "",
  };
}

/**
 * Deliberately does NOT parse the local <input> value through `new Date()`
 * (which would apply the browser's local timezone) — the raw "YYYY-MM-
 * DDTHH:mm" value is treated as already being the intended Europe/Sofia
 * wall-clock time and mapped 1:1 onto a UTC instant string, the same
 * literal-time convention office-schedule/attendance already use for
 * "HH:mm" strings. Known limitation: for an admin whose browser is not set
 * to Europe/Sofia, the entered time is stored as typed rather than
 * timezone-converted from their local clock.
 */
export function formValueToIso(value: string, isAllDay: boolean, isEnd: boolean): string {
  if (isAllDay) {
    if (!isEnd) {
      return `${value}T00:00:00.000Z`;
    }
    // Inclusive end-date input -> exclusive stored end instant (one day later).
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
  }
  return `${value}:00.000Z`;
}

/** Inverse of `formValueToIso`, for prefilling an edit form from stored data. */
export function isoToFormValue(iso: string, isAllDay: boolean, isEnd: boolean): string {
  if (isAllDay) {
    const date = new Date(iso);
    if (isEnd) {
      date.setUTCDate(date.getUTCDate() - 1); // exclusive stored end -> inclusive display date
    }
    return date.toISOString().slice(0, 10);
  }
  return iso.slice(0, 16);
}

function contentFields(values: EventFormValues) {
  return {
    titleBg: values.titleBg,
    titleEn: values.titleEn,
    descriptionBg: values.descriptionBg,
    descriptionEn: values.descriptionEn,
    startAt: formValueToIso(values.startAt, values.isAllDay, false),
    endAt: formValueToIso(values.endAt, values.isAllDay, true),
    isAllDay: values.isAllDay,
    location: values.location,
  };
}

function recurrenceInput(values: EventFormValues): EventRecurrenceInput | undefined {
  if (!values.recurrenceEnabled || values.byWeekdays.length === 0) {
    return undefined;
  }
  return {
    byWeekdays: values.byWeekdays,
    end:
      values.endType === "COUNT"
        ? { type: "COUNT", count: Number(values.count) || 1 }
        : { type: "UNTIL", until: values.until },
  };
}

export function formValuesToCreateRequest(values: EventFormValues): CreateEventRequest {
  return { ...contentFields(values), recurrence: recurrenceInput(values) };
}

export function formValuesToSeriesUpdateRequest(
  values: EventFormValues,
  expectedUpdatedAt: string,
): UpdateEventSeriesRequest {
  return { ...contentFields(values), recurrence: recurrenceInput(values), expectedUpdatedAt };
}

/** Content-only fields, shared by the occurrence-scope (`expectedUpdatedAt:
 * string | null`) and this+future-scope (`expectedUpdatedAt: string`) update
 * request shapes (neither carries a `recurrence` field) — `E` is inferred
 * from the argument so each call site gets back the exact matching type. */
export function formValuesToContentRequest<E extends string | null>(
  values: EventFormValues,
  expectedUpdatedAt: E,
): ReturnType<typeof contentFields> & { expectedUpdatedAt: E } {
  return { ...contentFields(values), expectedUpdatedAt };
}

export function seriesDetailToFormValues(detail: EventSeriesDetail): EventFormValues {
  return {
    titleBg: detail.titleBg,
    titleEn: detail.titleEn,
    descriptionBg: detail.descriptionBg,
    descriptionEn: detail.descriptionEn,
    startAt: isoToFormValue(detail.startAt, detail.isAllDay, false),
    endAt: isoToFormValue(detail.endAt, detail.isAllDay, true),
    isAllDay: detail.isAllDay,
    location: detail.location,
    recurrenceEnabled: detail.recurrence !== null,
    byWeekdays: detail.recurrence?.byWeekdays ?? [],
    endType: detail.recurrence?.end.type ?? "COUNT",
    count: detail.recurrence?.end.type === "COUNT" ? String(detail.recurrence.end.count) : "4",
    until: detail.recurrence?.end.type === "UNTIL" ? detail.recurrence.end.until : "",
  };
}

/** Content-only prefill for an occurrence/this+future edit — recurrence
 * fields are irrelevant there (the pattern is inherited, not editable). */
export function occurrenceToFormValues(occurrence: EventOccurrence): EventFormValues {
  return {
    ...emptyEventFormValues(),
    titleBg: occurrence.titleBg,
    titleEn: occurrence.titleEn,
    descriptionBg: occurrence.descriptionBg,
    descriptionEn: occurrence.descriptionEn,
    startAt: isoToFormValue(occurrence.startAt, occurrence.isAllDay, false),
    endAt: isoToFormValue(occurrence.endAt, occurrence.isAllDay, true),
    isAllDay: occurrence.isAllDay,
    location: occurrence.location,
  };
}
