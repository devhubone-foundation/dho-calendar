"use client";

import { useSearchParams } from "next/navigation";

import { type Dictionary, getDictionary } from "./dictionaries";
import { type Locale, resolveLocale } from "./locale";

/** Resolves the active locale from the current `?lang=` query param, per
 * visit and non-persistent, as required by ARCHITECTURE.md §14. */
export function useLocale(): Locale {
  const searchParams = useSearchParams();
  return resolveLocale(searchParams.get("lang"));
}

export function useDictionary(): Dictionary {
  return getDictionary(useLocale());
}
