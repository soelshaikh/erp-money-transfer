const TZ = 'Asia/Kolkata';

/** Current IST calendar date as YYYY-MM-DD */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** IST calendar date of any timestamp as YYYY-MM-DD */
export function toISTDate(ts: Date | string | number): string {
  return new Date(ts as any).toLocaleDateString('en-CA', { timeZone: TZ });
}
