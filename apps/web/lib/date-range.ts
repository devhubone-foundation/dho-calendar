/** Plain "YYYY-MM-DD" calendar-date helpers for querying the office-schedule
 * and attendance range endpoints (ARCHITECTURE.md §10: 3-month horizon). */

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addMonthsIso(date: string, amount: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + amount);
  return d.toISOString().slice(0, 10);
}

/** The default range shown by the office-settings and attendance pages: today
 * through three months out. */
export function defaultHorizonRange(): { from: string; to: string } {
  const from = todayIso();
  return { from, to: addMonthsIso(from, 3) };
}
