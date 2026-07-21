import type { DateRangeQuery, ErrorResponse, PublicCalendarResponse } from "@dho/contracts";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";

export class PublicApiError extends Error {
  constructor(
    readonly response: ErrorResponse,
    readonly status: number,
  ) {
    super(response.message);
    this.name = "PublicApiError";
  }
}

/** GET /api/public/calendar — the only calendar request the public page (and
 * the iframe embed) makes. Deliberately unauthenticated: no credentials, no
 * Authorization header, matching PRODUCT_BLUEPRINT.md §6.1 ("The public
 * route must not require authentication"). */
export async function getPublicCalendar(range: DateRangeQuery): Promise<PublicCalendarResponse> {
  const response = await fetch(`${API_ORIGIN}/api/public/calendar?from=${range.from}&to=${range.to}`);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const fallback: ErrorResponse = { code: "INTERNAL_ERROR", message: "Request failed" };
    throw new PublicApiError((body as ErrorResponse | null) ?? fallback, response.status);
  }

  return body as PublicCalendarResponse;
}
