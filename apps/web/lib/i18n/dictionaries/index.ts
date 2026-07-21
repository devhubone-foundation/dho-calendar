import type { Locale } from "../locale";
import bg from "./bg";
import en, { type Dictionary } from "./en";

export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { en, bg };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
