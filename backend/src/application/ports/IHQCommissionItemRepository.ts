import {
  HQCommissionItemDoc,
  HQCommissionItemCreateData,
} from '../../domain/types/hqCommission.types';

export default abstract class IHQCommissionItemRepository {
  abstract create(data: HQCommissionItemCreateData): Promise<HQCommissionItemDoc>;
  abstract findPending(tenantId: string, branchId?: string): Promise<HQCommissionItemDoc[]>;
  abstract findByIds(tenantId: string, ids: string[]): Promise<HQCommissionItemDoc[]>;
  abstract markInSettlement(tenantId: string, ids: string[], settlementId: string): Promise<void>;
  abstract markSettled(tenantId: string, ids: string[]): Promise<void>;
  abstract findBySettlement(tenantId: string, settlementId: string): Promise<HQCommissionItemDoc[]>;
  abstract findByTransactionId(tenantId: string, transactionId: string): Promise<HQCommissionItemDoc | null>;
}
