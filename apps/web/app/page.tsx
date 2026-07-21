"use client";

import { Card } from "@dho/ui";

import { LocaleSwitcher } from "../lib/i18n/LocaleSwitcher";
import { useDictionary } from "../lib/i18n/use-locale";

export default function PublicCalendarPage() {
  const dictionary = useDictionary();

  return (
    <main className="dho-shell-main">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <LocaleSwitcher />
      </div>
      <Card>
        <h1>{dictionary.publicPage.title}</h1>
        <p>{dictionary.publicPage.subtitle}</p>
      </Card>
    </main>
  );
}
