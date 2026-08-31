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

  /**
   * Enterprise 3-way commission split. `branchPct` applies once to the earning branch
   * (their own keep) and once again to the "other" branch on the transaction (collection
   * or payout, whichever didn't earn it) — the remainder goes to Head Office. Every amount
   * is derived by subtraction (never independently rounded) so the parts always reconcile
   * exactly to `commissionAmount`, even after paisa rounding.
   *
   * @param {number} commissionAmount - Total commission in rupees
   * @param {number} branchPct - 0–100, applied to each of the two branches
   * @param {number} headOfficePct - 0–100; caller must ensure 2*branchPct + headOfficePct === 100
   */
  static splitEnterprise(commissionAmount: any, branchPct: any, headOfficePct: any): {
    ownShareAmount: number;
    otherBranchShareAmount: number;
    headOfficeOwnShareAmount: number;
    hqShareAmount: number;
    hqSharePct: number;
  } {
    const pct = Number(branchPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
      throw new ValidationError('Branch commission percentage must be 0–50');
    }

    const total = Money.fromRupees(commissionAmount);
    const ownShare = new Money(Math.round(total.paisa * pct / 100));
    const hqShare = total.subtract(ownShare); // remainder — own + hq always reconciles to total
    const otherBranchShare = new Money(Math.min(Math.round(total.paisa * pct / 100), hqShare.paisa));
    const headOfficeOwnShare = hqShare.subtract(otherBranchShare); // remainder — otherBranch + hqOwn always reconciles to hq

    return {
      ownShareAmount: ownShare.toRupees(),
      otherBranchShareAmount: otherBranchShare.toRupees(),
      headOfficeOwnShareAmount: headOfficeOwnShare.toRupees(),
      hqShareAmount: hqShare.toRupees(),
      hqSharePct: Math.round((100 - pct) * 100) / 100,
    };
  }
}
