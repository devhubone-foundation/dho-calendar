"use client";

import { Badge, cn, pickBilingual } from "@dho/ui";
import type { EventOccurrence } from "@dho/contracts";

import type { Locale } from "../../lib/i18n/locale";
import { formatEventTime } from "../../lib/event-format";
import { useDictionary } from "../../lib/i18n/use-locale";
import { activatableProps } from "./activatable";
import { EventCoverImage } from "./EventCoverImage";

export interface EventCardProps {
  occurrence: EventOccurrence;
  locale: Locale;
  /** "compact" is a small chip for grid cells; "detailed" shows cover/description. */
  variant?: "compact" | "detailed";
  /** When provided, the card becomes keyboard-activatable (Enter/Space/click). */
  onActivate?: () => void;
}

/** Reusable event display — used across Month/Week/Day/Upcoming views and the
 * day-details modal in both the internal calendar and (Issue #5) the public
 * page. Events are always visually more prominent than plain attendance
 * markers (PRODUCT_BLUEPRINT.md §14.1), which this component intentionally
 * renders with a bordered, colored chip/card rather than a plain text line. */
export function EventCard({ occurrence, locale, variant = "compact", onActivate }: EventCardProps) {
  const dictionary = useDictionary();
  const title = pickBilingual({ bg: occurrence.titleBg, en: occurrence.titleEn }, locale);
  const description = pickBilingual(
    { bg: occurrence.descriptionBg, en: occurrence.descriptionEn },
    locale,
  );

  const timeLabel = occurrence.isAllDay
    ? dictionary.calendar.allDay
    : `${formatEventTime(occurrence.startAt, locale)}–${formatEventTime(occurrence.endAt, locale)}`;

  const interactive = onActivate ? activatableProps(onActivate) : {};

  if (variant === "compact") {
    return (
      <div className={cn("dho-cal-event-chip", onActivate && "dho-cal-event-chip--interactive")} {...interactive}>
        <span className="dho-cal-event-chip-time">{timeLabel}</span>
        <span className="dho-cal-event-chip-title">{title}</span>
      </div>
    );
  }

  return (
    <article className="dho-cal-event-detail" {...interactive}>
      <EventCoverImage
        coverImagePath={occurrence.coverImagePath}
        alt={title}
        className="dho-cal-event-detail-cover"
      />
      <div className="dho-cal-event-detail-body">
        <div className="dho-cal-event-detail-heading">
          <h3>{title}</h3>
          {occurrence.isRecurring ? <Badge variant="muted">{dictionary.events.recurringBadge}</Badge> : null}
        </div>
        <p className="dho-cal-event-detail-meta">
          {timeLabel} · {occurrence.location}
        </p>
        {description ? <p className="dho-cal-event-detail-description">{description}</p> : null}
      </div>
    </article>
  );
}
