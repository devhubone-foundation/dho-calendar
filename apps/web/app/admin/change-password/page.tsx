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
    <main className="dho-shell-main">
      <Card style={{ maxWidth: "24rem", margin: "0 auto" }}>
        <h1>{dictionary.auth.changePassword.title}</h1>
        {user?.mustChangePassword ? <p>{dictionary.auth.changePassword.prompt}</p> : null}
        <form onSubmit={handleSubmit}>
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
          {error ? <p role="alert">{error}</p> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? dictionary.auth.changePassword.submitting : dictionary.auth.changePassword.submit}
          </Button>
        </form>
      </Card>
    </main>
  );
}
