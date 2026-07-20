import type {
  ChangePasswordRequest,
  ErrorResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  RefreshResponse,
} from "@dho/contracts";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";

export class ApiError extends Error {
  constructor(
    readonly response: ErrorResponse,
    readonly status: number,
  ) {
    super(response.message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const fallback: ErrorResponse = { code: "INTERNAL_ERROR", message: "Request failed" };
    throw new ApiError((body as ErrorResponse | null) ?? fallback, response.status);
  }

  return body as T;
}

export function login(payload: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function refresh(): Promise<RefreshResponse> {
  return apiFetch<RefreshResponse>("/api/auth/refresh", { method: "POST" });
}

export function logout(): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/api/auth/logout", { method: "POST" });
}

export function changePassword(
  payload: ChangePasswordRequest,
  accessToken: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}

export function me(accessToken: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
