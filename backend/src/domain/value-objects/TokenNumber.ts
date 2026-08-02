/**
 * Token number format: BRANCHCODE-YYYYMMDD-SEQUENCE
 * Example: AHM-20260628-00042
 * Human readable, scannable as QR, unique per tenant.
 */
export default class TokenNumber {
  static generate(branchCode: any, sequenceNumber: any): string {
    const now = new Date();
    const dateStr =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const seq = String(sequenceNumber).padStart(5, '0');
    return `${branchCode.toUpperCase()}-${dateStr}-${seq}`;
  }

  static isValid(token: any): boolean {
    return /^[A-Z]{2,10}-\d{8}-\d{5}$/.test(token);
  }
}
