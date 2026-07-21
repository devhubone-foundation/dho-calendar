export const SUPPORTED_LOCALES = ["bg", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * `en` is the documented fallback for a missing/invalid `?lang=` value,
 * matching devhubone.com's own default (its root `/` resolves to `/en`
 * with no `lang` param) — see packages/ui/TOKENS.md for how that was
 * confirmed.
 */
export const DEFAULT_LOCALE: Locale = "en";

function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Resolves a raw `?lang=` value (possibly missing, repeated, or invalid) to
 * a supported locale, falling back to DEFAULT_LOCALE. */
export function resolveLocale(value: string | string[] | undefined | null): Locale {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && isSupportedLocale(candidate)) {
    return candidate;
  }
  return DEFAULT_LOCALE;
}
