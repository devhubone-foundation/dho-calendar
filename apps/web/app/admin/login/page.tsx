"use client";

import { Button, Card, FormField } from "@dho/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "../../../lib/auth/auth-context";
import { LocaleSwitcher } from "../../../lib/i18n/LocaleSwitcher";
import { useDictionary } from "../../../lib/i18n/use-locale";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const dictionary = useDictionary();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      router.push(user.mustChangePassword ? "/admin/change-password" : "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : dictionary.auth.login.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dho-auth-page">
      <div className="dho-auth-topbar">
        <LocaleSwitcher />
      </div>
      <div className="dho-auth-layout">
        <aside className="dho-auth-brand-panel">
          <h2>{dictionary.nav.brandName}</h2>
          <p>{dictionary.auth.brandTagline}</p>
        </aside>
        <Card className="dho-auth-card">
          <h1>{dictionary.auth.login.title}</h1>
          <form onSubmit={handleSubmit} className="dho-stack">
            <FormField
              label={dictionary.auth.login.email}
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <FormField
              label={dictionary.auth.login.password}
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error ? (
              <p role="alert" className="dho-field-error">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="accent" disabled={submitting}>
              {submitting ? dictionary.auth.login.submitting : dictionary.auth.login.submit}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
