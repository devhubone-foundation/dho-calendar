import type {
  AdminCreateMemberRequest,
  AdminUpdateMemberRequest,
  AttendanceException,
  AttendanceExceptionInput,
  AttendanceExceptionListResponse,
  AttendanceWarningListResponse,
  ChangePasswordRequest,
  CreateEventRequest,
  DateRangeQuery,
  DeleteEventOccurrenceRequest,
  DeleteEventSeriesScopeRequest,
  ErrorResponse,
  EventCoverUploadResponse,
  EventOccurrenceListResponse,
  EventSeriesDetail,
  LoginRequest,
  LoginResponse,
  MemberEffectiveAttendanceRangeResponse,
  MemberListResponse,
  MemberStatusUpdateRequest,
  MemberSummary,
  MemberWeeklyScheduleResponse,
  MeResponse,
  OfficeEffectiveRangeResponse,
  OfficeScheduleDefaultsResponse,
  OfficeScheduleException,
  OfficeScheduleExceptionInput,
  OfficeScheduleExceptionListResponse,
  ProfilePictureUploadResponse,
  RefreshResponse,
  SelfProfileUpdateRequest,
  UpdateEventOccurrenceRequest,
  UpdateEventSeriesFromOccurrenceRequest,
  UpdateEventSeriesRequest,
  UpdateOfficeDefaultsRequest,
  UpdateWeeklyScheduleRequest,
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

function rangeQuery(range: DateRangeQuery): string {
  return `?from=${range.from}&to=${range.to}`;
}

// --- Office schedule (admin manages defaults/exceptions; reads are open to any authenticated user) ---

export function getOfficeDefaults(accessToken: string): Promise<OfficeScheduleDefaultsResponse> {
  return apiFetch<OfficeScheduleDefaultsResponse>("/api/office-schedule/defaults", {
    headers: authHeaders(accessToken),
  });
}

export function updateOfficeDefaults(
  payload: UpdateOfficeDefaultsRequest,
  accessToken: string,
): Promise<OfficeScheduleDefaultsResponse> {
  return apiFetch<OfficeScheduleDefaultsResponse>("/api/office-schedule/defaults", {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function listOfficeExceptions(
  range: DateRangeQuery,
  accessToken: string,
): Promise<OfficeScheduleExceptionListResponse> {
  return apiFetch<OfficeScheduleExceptionListResponse>(`/api/office-schedule/exceptions${rangeQuery(range)}`, {
    headers: authHeaders(accessToken),
  });
}

export function upsertOfficeException(
  date: string,
  payload: OfficeScheduleExceptionInput,
  accessToken: string,
): Promise<OfficeScheduleException> {
  return apiFetch<OfficeScheduleException>(`/api/office-schedule/exceptions/${date}`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function deleteOfficeException(date: string, accessToken: string): Promise<void> {
  return apiFetch<void>(`/api/office-schedule/exceptions/${date}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export function getOfficeEffectiveRange(
  range: DateRangeQuery,
  accessToken: string,
): Promise<OfficeEffectiveRangeResponse> {
  return apiFetch<OfficeEffectiveRangeResponse>(`/api/office-schedule/effective${rangeQuery(range)}`, {
    headers: authHeaders(accessToken),
  });
}

// --- Attendance: self ---

export function getOwnWeeklySchedule(accessToken: string): Promise<MemberWeeklyScheduleResponse> {
  return apiFetch<MemberWeeklyScheduleResponse>("/api/attendance/me/weekly", {
    headers: authHeaders(accessToken),
  });
}

export function updateOwnWeeklySchedule(
  payload: UpdateWeeklyScheduleRequest,
  accessToken: string,
): Promise<MemberWeeklyScheduleResponse> {
  return apiFetch<MemberWeeklyScheduleResponse>("/api/attendance/me/weekly", {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function listOwnAttendanceExceptions(
  range: DateRangeQuery,
  accessToken: string,
): Promise<AttendanceExceptionListResponse> {
  return apiFetch<AttendanceExceptionListResponse>(`/api/attendance/me/exceptions${rangeQuery(range)}`, {
    headers: authHeaders(accessToken),
  });
}

export function upsertOwnAttendanceException(
  date: string,
  payload: AttendanceExceptionInput,
  accessToken: string,
): Promise<AttendanceException> {
  return apiFetch<AttendanceException>(`/api/attendance/me/exceptions/${date}`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function deleteOwnAttendanceException(date: string, accessToken: string): Promise<void> {
  return apiFetch<void>(`/api/attendance/me/exceptions/${date}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export function getOwnEffectiveAttendance(
  range: DateRangeQuery,
  accessToken: string,
): Promise<MemberEffectiveAttendanceRangeResponse> {
  return apiFetch<MemberEffectiveAttendanceRangeResponse>(`/api/attendance/me/effective${rangeQuery(range)}`, {
    headers: authHeaders(accessToken),
  });
}

// --- Attendance: admin managing any member ---

export function getMemberWeeklySchedule(
  userId: string,
  accessToken: string,
): Promise<MemberWeeklyScheduleResponse> {
  return apiFetch<MemberWeeklyScheduleResponse>(`/api/attendance/members/${userId}/weekly`, {
    headers: authHeaders(accessToken),
  });
}

export function updateMemberWeeklySchedule(
  userId: string,
  payload: UpdateWeeklyScheduleRequest,
  accessToken: string,
): Promise<MemberWeeklyScheduleResponse> {
  return apiFetch<MemberWeeklyScheduleResponse>(`/api/attendance/members/${userId}/weekly`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function listMemberAttendanceExceptions(
  userId: string,
  range: DateRangeQuery,
  accessToken: string,
): Promise<AttendanceExceptionListResponse> {
  return apiFetch<AttendanceExceptionListResponse>(
    `/api/attendance/members/${userId}/exceptions${rangeQuery(range)}`,
    { headers: authHeaders(accessToken) },
  );
}

export function upsertMemberAttendanceException(
  userId: string,
  date: string,
  payload: AttendanceExceptionInput,
  accessToken: string,
): Promise<AttendanceException> {
  return apiFetch<AttendanceException>(`/api/attendance/members/${userId}/exceptions/${date}`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function deleteMemberAttendanceException(
  userId: string,
  date: string,
  accessToken: string,
): Promise<void> {
  return apiFetch<void>(`/api/attendance/members/${userId}/exceptions/${date}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export function getMemberEffectiveAttendance(
  userId: string,
  range: DateRangeQuery,
  accessToken: string,
): Promise<MemberEffectiveAttendanceRangeResponse> {
  return apiFetch<MemberEffectiveAttendanceRangeResponse>(
    `/api/attendance/members/${userId}/effective${rangeQuery(range)}`,
    { headers: authHeaders(accessToken) },
  );
}

export function getAttendanceWarnings(accessToken: string): Promise<AttendanceWarningListResponse> {
  return apiFetch<AttendanceWarningListResponse>("/api/attendance/warnings", {
    headers: authHeaders(accessToken),
  });
}

// --- Events (collaborative: any active member/admin creates/edits/deletes any event) ---

export function listEvents(range: DateRangeQuery, accessToken: string): Promise<EventOccurrenceListResponse> {
  return apiFetch<EventOccurrenceListResponse>(`/api/events${rangeQuery(range)}`, {
    headers: authHeaders(accessToken),
  });
}

export function getEvent(seriesId: string, accessToken: string): Promise<EventSeriesDetail> {
  return apiFetch<EventSeriesDetail>(`/api/events/${seriesId}`, { headers: authHeaders(accessToken) });
}

export function createEvent(payload: CreateEventRequest, accessToken: string): Promise<EventSeriesDetail> {
  return apiFetch<EventSeriesDetail>("/api/events", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function updateEventSeries(
  seriesId: string,
  payload: UpdateEventSeriesRequest,
  accessToken: string,
): Promise<EventSeriesDetail> {
  return apiFetch<EventSeriesDetail>(`/api/events/${seriesId}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function deleteEventSeries(
  seriesId: string,
  payload: DeleteEventSeriesScopeRequest,
  accessToken: string,
): Promise<void> {
  return apiFetch<void>(`/api/events/${seriesId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function updateEventOccurrence(
  seriesId: string,
  date: string,
  payload: UpdateEventOccurrenceRequest,
  accessToken: string,
): Promise<void> {
  return apiFetch<void>(`/api/events/${seriesId}/occurrences/${date}`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function deleteEventOccurrence(
  seriesId: string,
  date: string,
  payload: DeleteEventOccurrenceRequest,
  accessToken: string,
): Promise<void> {
  return apiFetch<void>(`/api/events/${seriesId}/occurrences/${date}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function updateEventSeriesFromOccurrence(
  seriesId: string,
  date: string,
  payload: UpdateEventSeriesFromOccurrenceRequest,
  accessToken: string,
): Promise<EventSeriesDetail> {
  return apiFetch<EventSeriesDetail>(`/api/events/${seriesId}/occurrences/${date}/future`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function deleteEventSeriesFromOccurrence(
  seriesId: string,
  date: string,
  payload: DeleteEventSeriesScopeRequest,
  accessToken: string,
): Promise<void> {
  return apiFetch<void>(`/api/events/${seriesId}/occurrences/${date}/future`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function uploadEventCover(
  seriesId: string,
  file: File,
  accessToken: string,
): Promise<EventCoverUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<EventCoverUploadResponse>(`/api/events/${seriesId}/cover`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: formData,
  });
}

export function removeEventCover(seriesId: string, accessToken: string): Promise<void> {
  return apiFetch<void>(`/api/events/${seriesId}/cover`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}
