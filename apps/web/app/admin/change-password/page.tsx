"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "../../../lib/auth/auth-context";

export default function ChangePasswordPage() {
  const { changePassword, user, status } = useAuth();
  const router = useRouter();
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
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setSubmitting(false);
    }
  }

  if (status !== "authenticated") {
    return <p>Loading...</p>;
  }

  return (
    <main>
      <h1>Change your password</h1>
      {user?.mustChangePassword ? <p>You must set a new password before continuing.</p> : null}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="currentPassword">Current password</label>
          <br />
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="newPassword">New password</label>
          <br />
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={10}
          />
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save new password"}
        </button>
      </form>
    </main>
  );
}
