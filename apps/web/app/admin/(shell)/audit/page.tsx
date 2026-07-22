"use client";

import { Card } from "@dho/ui";
import type { AuditLogEntry } from "@dho/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getAuditLog } from "../../../../lib/auth/api-client";
import { useAuth } from "../../../../lib/auth/auth-context";
import { useDictionary, useLocale } from "../../../../lib/i18n/use-locale";

function formatTimestamp(isoInstant: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    timeZone: "Europe/Sofia",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoInstant));
}

/** ADMIN-only audit history (PRODUCT_BLUEPRINT.md §20): the authoritative
 * source is the backend's seven-day retention window — this page never
 * paginates or filters further, it just renders whatever the API returns. */
export default function AuditPage() {
  const { user, accessToken } = useAuth();
  const dictionary = useDictionary();
  const locale = useLocale();
  const router = useRouter();

  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/admin");
    }
  }, [user, router]);

  useEffect(() => {
    if (!accessToken) return;
    getAuditLog(accessToken)
      .then((result) => {
        setEntries(result.entries);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : dictionary.audit.genericLoadError);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <Card>
      <h1>{dictionary.audit.title}</h1>
      <p>{dictionary.audit.subtitle}</p>

      {loadError ? <p role="alert">{loadError}</p> : null}
      {!entries ? <p>{dictionary.common.loading}</p> : null}

      {entries && entries.length === 0 ? (
        <div className="dho-empty-state">
          <span className="dho-empty-state-icon" aria-hidden="true">
            🗂️
          </span>
          <p>{dictionary.audit.noEntries}</p>
        </div>
      ) : null}

      {entries && entries.length > 0 ? (
        <div className="dho-table-scroll" style={{ marginTop: "1rem" }}>
          <table>
            <thead>
              <tr>
                <th>{dictionary.audit.when}</th>
                <th>{dictionary.audit.action}</th>
                <th>{dictionary.audit.actor}</th>
                <th>{dictionary.audit.target}</th>
                <th>{dictionary.audit.details}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatTimestamp(entry.createdAt, locale)}</td>
                  <td>{entry.action}</td>
                  <td>{entry.actorEmail ?? dictionary.audit.systemActor}</td>
                  <td>
                    {entry.targetType}
                    {entry.targetId ? ` (${entry.targetId})` : ""}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>
                    {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
