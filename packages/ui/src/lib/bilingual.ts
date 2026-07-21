export type Locale = "bg" | "en";

export interface BilingualValue {
  bg: string;
  en: string;
}

/**
 * Selects the value for the active locale, falling back to the other
 * language when the active locale's value is empty/whitespace-only, and
 * finally to an empty string when both are empty. Used for bilingual
 * content fields such as member qualification and (later) event text.
 */
export function pickBilingual(value: BilingualValue, locale: Locale): string {
  const other: Locale = locale === "bg" ? "en" : "bg";
  const primary = value[locale]?.trim();
  if (primary) {
    return primary;
  }
  const fallback = value[other]?.trim();
  return fallback ?? "";
}
