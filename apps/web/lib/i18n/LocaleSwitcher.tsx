"use client";

import { LanguageSwitch } from "@dho/ui";
import { usePathname, useSearchParams } from "next/navigation";

import { useLocale } from "./use-locale";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <LanguageSwitch
      activeLocale={locale}
      hrefFor={(candidate) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("lang", candidate);
        return `${pathname}?${params.toString()}`;
      }}
    />
  );
}
