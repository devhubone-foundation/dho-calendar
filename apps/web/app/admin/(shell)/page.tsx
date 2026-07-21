"use client";

import { Badge, Card } from "@dho/ui";
import type { AttendanceWarning } from "@dho/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getAttendanceWarnings } from "../../../lib/auth/api-client";
import { useAuth } from "../../../lib/auth/auth-context";
import { useDictionary } from "../../../lib/i18n/use-locale";

export default function AdminDashboardPage() {
  const { user, accessToken } = useAuth();
  const dictionary = useDictionary();

  const [warnings, setWarnings] = useState<AttendanceWarning[] | null>(null);
  const [warningsError, setWarningsError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || user?.role !== "ADMIN") return;
    getAttendanceWarnings(accessToken)
      .then((result) => setWarnings(result.warnings))
      .catch((err) => setWarningsError(err instanceof Error ? err.message : dictionary.dashboard.reviewAttendance));
  }, [accessToken, user?.role, dictionary.dashboard.reviewAttendance]);

  if (!user) {
    return null;
  }

  return (
    <>
      <Card>
        <h1>{dictionary.dashboard.title}</h1>
        <p>
          {dictionary.dashboard.signedInAs
            .replace("{email}", user.email)
            .replace("{role}", user.role)}
        </p>
      </Card>

      {user.role === "ADMIN" ? (
        <Card style={{ marginTop: "1.5rem" }}>
          <h2>{dictionary.dashboard.warningsTitle}</h2>

          {warningsError ? <p role="alert">{warningsError}</p> : null}

          {!warnings && !warningsError ? <p>{dictionary.dashboard.warningsLoading}</p> : null}

          {warnings && warnings.length === 0 ? <p>{dictionary.dashboard.noWarnings}</p> : null}

          {warnings && warnings.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {warnings.map((warning) => (
                <li key={warning.date} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Badge variant="danger">{warning.date}</Badge>
                  <span>
                    {warning.reason === "NO_RECORDS"
                      ? dictionary.dashboard.warningReasonNoRecords
                      : dictionary.dashboard.warningReasonUncertain}
                  </span>
                  <Link href="/admin/attendance">{dictionary.dashboard.reviewAttendance}</Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
