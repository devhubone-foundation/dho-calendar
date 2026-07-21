import type {
  AdminCreateMemberRequest,
  AdminUpdateMemberRequest,
  ChangePasswordRequest,
  ErrorResponse,
  LoginRequest,
  LoginResponse,
  MemberListResponse,
  MemberStatusUpdateRequest,
  MemberSummary,
  MeResponse,
  ProfilePictureUploadResponse,
  RefreshResponse,
  SelfProfileUpdateRequest,
} from "@dho/contracts";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";

export function resolveUploadUrl(relativePath: string): string {
  return `${API_ORIGIN}/api/uploads/${relativePath}`;
}

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
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
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

export function getOwnProfile(accessToken: string): Promise<MemberSummary> {
  return apiFetch<MemberSummary>("/api/me/profile", { headers: authHeaders(accessToken) });
}

export function updateOwnProfile(
  payload: SelfProfileUpdateRequest,
  accessToken: string,
): Promise<MemberSummary> {
  return apiFetch<MemberSummary>("/api/me/profile", {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function uploadOwnProfilePicture(
  file: File,
  accessToken: string,
): Promise<ProfilePictureUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<ProfilePictureUploadResponse>("/api/me/profile/picture", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: formData,
  });
}

export function adminListMembers(accessToken: string): Promise<MemberListResponse> {
  return apiFetch<MemberListResponse>("/api/users", { headers: authHeaders(accessToken) });
}

export function adminCreateMember(
  payload: AdminCreateMemberRequest,
  accessToken: string,
): Promise<MemberSummary> {
  return apiFetch<MemberSummary>("/api/users", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function adminUpdateMember(
  id: string,
  payload: AdminUpdateMemberRequest,
  accessToken: string,
): Promise<MemberSummary> {
  return apiFetch<MemberSummary>(`/api/users/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function adminSetMemberStatus(
  id: string,
  payload: MemberStatusUpdateRequest,
  accessToken: string,
): Promise<MemberSummary> {
  return apiFetch<MemberSummary>(`/api/users/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}
