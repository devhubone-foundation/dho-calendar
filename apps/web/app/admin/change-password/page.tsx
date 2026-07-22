"use client";

import { Button, Card, FormField } from "@dho/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "../../../lib/auth/auth-context";
import { useDictionary } from "../../../lib/i18n/use-locale";

export default function ChangePasswordPage() {
  const { changePassword, user, status } = useAuth();
  const router = useRouter();
  const dictionary = useDictionary();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : dictionary.auth.changePassword.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  if (status !== "authenticated") {
    return <p>{dictionary.common.loading}</p>;
  }

  return (
    <div className="dho-auth-page">
      <div className="dho-auth-layout">
        <aside className="dho-auth-brand-panel">
          <h2>{dictionary.nav.brandName}</h2>
          <p>{dictionary.auth.brandTagline}</p>
        </aside>
        <Card className="dho-auth-card">
          <h1>{dictionary.auth.changePassword.title}</h1>
          {user?.mustChangePassword ? <p>{dictionary.auth.changePassword.prompt}</p> : null}
          <form onSubmit={handleSubmit} className="dho-stack">
            <FormField
              label={dictionary.auth.changePassword.currentPassword}
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <FormField
              label={dictionary.auth.changePassword.newPassword}
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={10}
            />
            {error ? (
              <p role="alert" className="dho-field-error">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="accent" disabled={submitting}>
              {submitting ? dictionary.auth.changePassword.submitting : dictionary.auth.changePassword.submit}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
