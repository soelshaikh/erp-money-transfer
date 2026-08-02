const TZ = 'Asia/Kolkata';

/** Current IST calendar date as YYYY-MM-DD */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** IST calendar date of any timestamp as YYYY-MM-DD */
export function toISTDate(ts: Date | string | number): string {
  return new Date(ts as any).toLocaleDateString('en-CA', { timeZone: TZ });
}

/** IST calendar month of any timestamp as YYYY-MM */
export function toISTMonth(ts: Date | string | number): string {
  return toISTDate(ts).slice(0, 7);
}

/** UTC Date representing midnight IST for a YYYY-MM-DD string */
export function istStartOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000+05:30`);
}

/** UTC Date representing 23:59:59.999 IST for a YYYY-MM-DD string */
export function istEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+05:30`);
}

/**
 * Smart filter-date parser for repository methods.
 * Handles three formats that callers may pass:
 *   - Date object (from GetPeriodComparison / GetDashboard default) → use as-is
 *   - Full ISO string with 'T' (from mobile toISOString()) → new Date(v)
 *   - YYYY-MM-DD string (from use-cases / mobile date pickers) → IST midnight or end-of-day
 */
export function parseISTFilterDate(v: any, endOfDay: boolean): Date {
  if (v instanceof Date) return v;
  if (typeof v === 'string' && v.includes('T')) return new Date(v);
  return endOfDay ? istEndOfDay(v) : istStartOfDay(v);
}
