import { ValidationError } from '../errors';

/**
 * Immutable money value object. All arithmetic in paisa (integer) to avoid
 * floating-point errors (0.1 + 0.2 ≠ 0.3 in IEEE 754).
 */
export default class Money {
  #paisa: number;

  constructor(paisa: any) {
    const p = Math.round(Number(paisa));
    if (!Number.isFinite(p)) throw new ValidationError('Invalid money value');
    this.#paisa = p;
  }

  static fromRupees(amount: any): Money {
    const num = Number(amount);
    if (!Number.isFinite(num) || num < 0) throw new ValidationError('Amount must be a non-negative number');
    return new Money(Math.round(num * 100));
  }

  static ZERO = new Money(0);

  get paisa(): number { return this.#paisa; }

  toRupees(): number { return this.#paisa / 100; }

  add(other: Money): Money { return new Money(this.#paisa + other.paisa); }

  subtract(other: Money): Money {
    const result = this.#paisa - other.paisa;
    if (result < 0) throw new ValidationError('Amount cannot be negative after subtraction');
    return new Money(result);
  }

  isGreaterThan(other: Money): boolean { return this.#paisa > other.paisa; }

  equals(other: Money): boolean { return this.#paisa === other.paisa; }

  toString(): string { return `₹${this.toRupees().toFixed(2)}`; }
}
