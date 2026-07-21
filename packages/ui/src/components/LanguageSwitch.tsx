export interface LanguageSwitchProps {
  activeLocale: "bg" | "en";
  /** Builds the href for a candidate locale, e.g. preserving pathname + other query params. */
  hrefFor: (locale: "bg" | "en") => string;
}

const LOCALES = ["bg", "en"] as const;

export function LanguageSwitch({ activeLocale, hrefFor }: LanguageSwitchProps) {
  return (
    <nav className="dho-language-switch" aria-label="Language">
      {LOCALES.map((locale) => (
        <a key={locale} href={hrefFor(locale)} aria-current={locale === activeLocale ? "true" : undefined}>
          {locale}
        </a>
      ))}
    </nav>
  );
}
