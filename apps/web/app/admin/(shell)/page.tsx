"use client";

import { Card } from "@dho/ui";

import { useAuth } from "../../../lib/auth/auth-context";
import { useDictionary } from "../../../lib/i18n/use-locale";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const dictionary = useDictionary();

  if (!user) {
    return null;
  }

  return (
    <Card>
      <h1>{dictionary.dashboard.title}</h1>
      <p>
        {dictionary.dashboard.signedInAs
          .replace("{email}", user.email)
          .replace("{role}", user.role)}
      </p>
    </Card>
  );
}
