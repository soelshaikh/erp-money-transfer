import Money from './Money';
import { ValidationError } from '../errors';
import { COMMISSION_TYPE } from '../../config/constants';

/**
 * Commission value object. Single place for all commission calculation logic.
 * Changing commission rules = change only this file.
 */
export default class Commission {
  /**
   * @param {number} amount - Original amount in rupees
   * @param {'flat'|'percentage'} type
   * @param {number} value - Flat rupee amount OR percentage (0–100)
   * @returns {{ commissionAmount: number, finalAmount: number }}
   */
  static calculate(amount: any, type: any, value: any): { commissionAmount: number; finalAmount: number } {
    if (!Object.values(COMMISSION_TYPE).includes(type)) {
      throw new ValidationError(`Invalid commission type: ${type}`);
    }

    const amountMoney = Money.fromRupees(amount);
    let commissionMoney: Money;

    if (type === COMMISSION_TYPE.FLAT) {
      commissionMoney = Money.fromRupees(value);
    } else {
      // percentage — value is 0–100
      const pct = Number(value);
      if (pct < 0 || pct > 100) throw new ValidationError('Commission percentage must be 0–100');
      commissionMoney = new Money(Math.round(amountMoney.paisa * pct / 100));
    }

    if (commissionMoney.isGreaterThan(amountMoney)) {
      throw new ValidationError('Commission cannot exceed the transaction amount');
    }

    const finalMoney = amountMoney.subtract(commissionMoney);

    return {
      commissionAmount: commissionMoney.toRupees(),
      finalAmount: finalMoney.toRupees(),
    };
  }
}
