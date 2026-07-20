"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "@dho/contracts";

import * as api from "./api-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthenticatedUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    api
      .refresh()
      .then((result) => {
        if (cancelled) return;
        setAccessToken(result.accessToken);
        setUser(result.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      status,
      async login(email: string, password: string) {
        const result = await api.login({ email, password });
        setAccessToken(result.accessToken);
        setUser(result.user);
        setStatus("authenticated");
        return result.user;
      },
      async logout() {
        await api.logout().catch(() => undefined);
        setAccessToken(null);
        setUser(null);
        setStatus("unauthenticated");
      },
      async changePassword(currentPassword: string, newPassword: string) {
        if (!accessToken) {
          throw new Error("Not authenticated");
        }
        const result = await api.changePassword({ currentPassword, newPassword }, accessToken);
        setAccessToken(result.accessToken);
        setUser(result.user);
        return result.user;
      },
    }),
    [user, accessToken, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
