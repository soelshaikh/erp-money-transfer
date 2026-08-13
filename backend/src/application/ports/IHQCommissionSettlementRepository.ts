import {
  HQCommissionSettlementDoc,
  HQCommissionSettlementCreateData,
  HQSettlementFilters,
  PaginatedSettlements,
} from '../../domain/types/hqCommission.types';

export default abstract class IHQCommissionSettlementRepository {
  abstract create(data: HQCommissionSettlementCreateData): Promise<HQCommissionSettlementDoc>;
  abstract findAll(tenantId: string, filters?: HQSettlementFilters): Promise<PaginatedSettlements>;
  abstract findById(tenantId: string, id: string): Promise<HQCommissionSettlementDoc | null>;
  abstract complete(tenantId: string, id: string, completedBy: string, completedByName: string): Promise<HQCommissionSettlementDoc | null>;
}
