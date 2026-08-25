import { Types } from 'mongoose';
import { PAYMENT_METHOD, ROLES } from '../../config/constants';

export type HQCommissionItemStatus = 'pending' | 'in_settlement' | 'settled';
export type HQSettlementStatus = 'pending' | 'completed';
export type InitiatedBySide = 'branch' | 'head_office';
export type PaymentMode = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD];

// ─── Document shapes (what comes back from MongoDB) ────────────────────────

export interface HQCommissionItemDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  branchName: string;
  branchCode: string;
  transactionId: Types.ObjectId;
  tokenNumber: string;
  commissionAmount: number;
  hqSharePct: number;
  hqShareAmount: number;
  otherBranchId: Types.ObjectId | null;
  otherBranchName: string | null;
  otherBranchCode: string | null;
  otherBranchShareAmount: number;
  headOfficeOwnShareAmount: number;
  status: HQCommissionItemStatus;
  settlementId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HQCommissionSettlementDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  branchName: string;
  branchCode: string;
  itemIds: Types.ObjectId[];
  itemCount: number;
  totalCommission: number;
  totalHQShare: number;
  paymentMode: PaymentMode;
  status: HQSettlementStatus;
  notes: string | null;
  initiatedBySide: InitiatedBySide;
  initiatedBy: Types.ObjectId;
  initiatedByName: string;
  initiatedAt: Date;
  completedBy: Types.ObjectId | null;
  completedByName: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HQCommissionSettlementWithItems extends HQCommissionSettlementDoc {
  items: HQCommissionItemDoc[];
}

// ─── Create payloads ────────────────────────────────────────────────────────

export interface HQCommissionItemCreateData {
  tenantId: Types.ObjectId | string;
  branchId: Types.ObjectId | string;
  branchName: string;
  branchCode: string;
  transactionId: Types.ObjectId | string;
  tokenNumber: string;
  commissionAmount: number;
  hqSharePct: number;
  hqShareAmount: number;
  otherBranchId?: Types.ObjectId | string | null;
  otherBranchName?: string | null;
  otherBranchCode?: string | null;
  otherBranchShareAmount?: number;
  headOfficeOwnShareAmount?: number;
}

export interface HQCommissionSettlementCreateData {
  tenantId: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  itemIds: string[];
  itemCount: number;
  totalCommission: number;
  totalHQShare: number;
  paymentMode: PaymentMode;
  notes: string | null;
  status: 'pending';
  initiatedBySide: InitiatedBySide;
  initiatedBy: string;
  initiatedByName: string;
  initiatedAt: Date;
}

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PaginatedSettlements {
  data: HQCommissionSettlementDoc[];
  total: number;
  page: number;
  limit: number;
}

// ─── Filter shapes ──────────────────────────────────────────────────────────

export interface HQSettlementFilters {
  branchId?: string;
  status?: HQSettlementStatus;
  page?: number;
  limit?: number;
}

// ─── Use-case param shapes ──────────────────────────────────────────────────

export type UserRole = typeof ROLES[keyof typeof ROLES];

export interface GetHQItemsParams {
  tenantId: string;
  role: UserRole;
  branchId?: string;
  filterBranchId?: string;
}

export interface GetHQSettlementsParams {
  tenantId: string;
  role: UserRole;
  branchId?: string;
  filterBranchId?: string;
  status?: HQSettlementStatus;
  page?: number;
  limit?: number;
}

export interface GetHQSettlementParams {
  tenantId: string;
  settlementId: string;
}

export interface CreateHQSettlementParams {
  tenantId: string;
  branchId: string;
  itemIds: string[];
  paymentMode: PaymentMode;
  notes?: string;
  initiatedBySide: InitiatedBySide;
  userId: string;
  actorName: string;
  actorUsername: string;
}

export interface CompleteHQSettlementParams {
  tenantId: string;
  settlementId: string;
  userId: string;
  actorName: string;
  actorUsername: string;
}
