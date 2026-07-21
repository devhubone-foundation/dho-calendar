"use client";

import { Button } from "@dho/ui";

import { useDictionary } from "../../lib/i18n/use-locale";

export type CalendarViewKind = "month" | "week" | "day" | "upcoming";

export interface ViewSwitcherProps {
  view: CalendarViewKind;
  onChange: (view: CalendarViewKind) => void;
}

/** Visible Month/Week/Day/Upcoming switcher (PRODUCT_BLUEPRINT.md §15). */
export function ViewSwitcher({ view, onChange }: ViewSwitcherProps) {
  const dictionary = useDictionary();
  const options: { key: CalendarViewKind; label: string }[] = [
    { key: "month", label: dictionary.calendar.viewMonth },
    { key: "week", label: dictionary.calendar.viewWeek },
    { key: "day", label: dictionary.calendar.viewDay },
    { key: "upcoming", label: dictionary.calendar.viewUpcoming },
  ];

  return (
    <div className="dho-cal-view-switcher" role="tablist" aria-label={dictionary.calendar.title}>
      {options.map((option) => (
        <Button
          key={option.key}
          variant={view === option.key ? "primary" : "secondary"}
          size="small"
          role="tab"
          aria-selected={view === option.key}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
