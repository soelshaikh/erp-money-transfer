/** Format a rupee amount with space: ₹ 1,23,456 */
export function fmtAmt(n: number): string {
  return `₹ ${Math.abs(n).toLocaleString('en-IN')}`;
}

/** Format with sign prefix and space: + ₹ 1,000  /  − ₹ 500  /  ₹ 0 */
export function fmtAmtSigned(n: number): string {
  if (n === 0) return `₹ 0`;
  const sign = n < 0 ? '− ' : '+ ';
  return `${sign}₹ ${Math.abs(n).toLocaleString('en-IN')}`;
}

/** 12/07/2026 */
export function fmtDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** 12/07 — compact, no year, for space-constrained date buttons */
export function fmtDateShort(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** 10:30 AM */
export function fmtTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** 12/07/2026, 10:30 AM */
export function fmtDateTime(iso: string | Date): string {
  return `${fmtDate(iso)}, ${fmtTime(iso)}`;
}
