import { APPROVAL_STATUS, PAYMENT_STATUS } from '../../config/constants';
import { BusinessRuleError } from '../errors';

export class Transaction {
  id: any;
  tenantId: any;
  tokenNumber: any;
  collectionBranchId: any;
  payoutBranchId: any;
  senderId: any;
  receiverId: any;
  amount: any;
  commissionType: any;
  commissionValue: any;
  commissionAmount: any;
  finalAmount: any;
  approvalStatus: any;
  paymentStatus: any;
  createdBy: any;
  approvedBy: any;
  approvedAt: any;
  remarks: any;
  createdAt: any;
  updatedAt: any;

  constructor(data: any) {
    this.id = data.id || null;
    this.tenantId = data.tenantId;
    this.tokenNumber = data.tokenNumber;
    this.collectionBranchId = data.collectionBranchId;
    this.payoutBranchId = data.payoutBranchId;
    this.senderId = data.senderId;
    this.receiverId = data.receiverId;
    this.amount = data.amount;
    this.commissionType = data.commissionType;
    this.commissionValue = data.commissionValue;
    this.commissionAmount = data.commissionAmount;
    this.finalAmount = data.finalAmount;
    this.approvalStatus = data.approvalStatus || APPROVAL_STATUS.PENDING;
    this.paymentStatus = data.paymentStatus || PAYMENT_STATUS.PENDING;
    this.createdBy = data.createdBy;
    this.approvedBy = data.approvedBy || null;
    this.approvedAt = data.approvedAt || null;
    this.remarks = data.remarks || null;
    this.createdAt = data.createdAt || null;
    this.updatedAt = data.updatedAt || null;
  }

  canApprove(): boolean {
    return this.approvalStatus === APPROVAL_STATUS.PENDING;
  }

  canReject(): boolean {
    return this.approvalStatus === APPROVAL_STATUS.PENDING;
  }

  canCompletePayment(): boolean {
    return (
      this.approvalStatus === APPROVAL_STATUS.APPROVED &&
      this.paymentStatus === PAYMENT_STATUS.PENDING
    );
  }

  approve(userId: any): this {
    if (!this.canApprove()) {
      throw new BusinessRuleError(`Cannot approve a transaction with status: ${this.approvalStatus}`);
    }
    this.approvalStatus = APPROVAL_STATUS.APPROVED;
    this.approvedBy = userId;
    this.approvedAt = new Date();
    return this;
  }

  reject(userId: any, remarks: any): this {
    if (!this.canReject()) {
      throw new BusinessRuleError(`Cannot reject a transaction with status: ${this.approvalStatus}`);
    }
    this.approvalStatus = APPROVAL_STATUS.REJECTED;
    this.approvedBy = userId;
    this.approvedAt = new Date();
    this.remarks = remarks;
    return this;
  }

  completePayment(): this {
    if (!this.canCompletePayment()) {
      throw new BusinessRuleError('Transaction is not in a state to complete payment');
    }
    this.paymentStatus = PAYMENT_STATUS.COMPLETED;
    return this;
  }
}
