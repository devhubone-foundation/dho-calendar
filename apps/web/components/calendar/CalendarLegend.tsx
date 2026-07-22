"use client";

import { useDictionary } from "../../lib/i18n/use-locale";

/** Self-explanatory color key shown under the public calendar views, so a
 * first-time, non-technical visitor never has to guess what a color means
 * (Issue #12: "a legend present"). */
export function CalendarLegend() {
  const dictionary = useDictionary();

  const items: { swatchClass: string; label: string }[] = [
    { swatchClass: "dho-legend-swatch--open", label: dictionary.calendar.legendOpen },
    { swatchClass: "dho-legend-swatch--attending", label: dictionary.calendar.legendAttending },
    { swatchClass: "dho-legend-swatch--not-sure", label: dictionary.calendar.legendNotSure },
    { swatchClass: "dho-legend-swatch--event", label: dictionary.calendar.legendEvent },
    { swatchClass: "dho-legend-swatch--changed", label: dictionary.calendar.legendChanged },
    { swatchClass: "dho-legend-swatch--closed", label: dictionary.calendar.legendClosed },
  ];

  return (
    <div className="dho-legend" role="note" aria-label={dictionary.calendar.legendTitle}>
      {items.map((item) => (
        <span key={item.swatchClass} className="dho-legend-item">
          <span className={`dho-legend-swatch ${item.swatchClass}`} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}
