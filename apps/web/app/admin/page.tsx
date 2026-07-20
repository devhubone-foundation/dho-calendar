"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "../../lib/auth/auth-context";

export default function AdminDashboardPage() {
  const { user, status, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    } else if (status === "authenticated" && user?.mustChangePassword) {
      router.push("/admin/change-password");
    }
  }, [status, user, router]);

  if (status !== "authenticated" || !user || user.mustChangePassword) {
    return <p>Loading...</p>;
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>
        Signed in as {user.email} ({user.role}). Calendar, attendance, and event management ship
        in later issues.
      </p>
      <button
        type="button"
        onClick={() => {
          void logout().then(() => router.push("/admin/login"));
        }}
      >
        Sign out
      </button>
    </main>
  );
}
