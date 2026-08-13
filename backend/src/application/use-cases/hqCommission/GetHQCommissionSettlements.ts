import { ROLES } from '../../../config/constants';
import IHQCommissionSettlementRepository from '../../ports/IHQCommissionSettlementRepository';
import {
  GetHQSettlementsParams,
  PaginatedSettlements,
} from '../../../domain/types/hqCommission.types';

export default class GetHQCommissionSettlements {
  private hqCommissionSettlementRepository: IHQCommissionSettlementRepository;

  constructor(deps: { hqCommissionSettlementRepository: IHQCommissionSettlementRepository }) {
    this.hqCommissionSettlementRepository = deps.hqCommissionSettlementRepository;
  }

  async execute(params: GetHQSettlementsParams): Promise<PaginatedSettlements> {
    const { tenantId, role, branchId, filterBranchId, status, page, limit } = params;
    const effectiveBranchId = role === ROLES.BRANCH ? branchId : filterBranchId;

    return this.hqCommissionSettlementRepository.findAll(tenantId, {
      branchId: effectiveBranchId,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 30,
    });
  }
}
