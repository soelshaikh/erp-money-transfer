import { ROLES } from '../../../config/constants';
import IHQCommissionItemRepository from '../../ports/IHQCommissionItemRepository';
import { HQCommissionItemDoc, GetHQItemsParams } from '../../../domain/types/hqCommission.types';

export default class GetHQCommissionItems {
  private hqCommissionItemRepository: IHQCommissionItemRepository;

  constructor(deps: { hqCommissionItemRepository: IHQCommissionItemRepository }) {
    this.hqCommissionItemRepository = deps.hqCommissionItemRepository;
  }

  async execute(params: GetHQItemsParams): Promise<HQCommissionItemDoc[]> {
    const { tenantId, role, branchId, filterBranchId } = params;
    const effectiveBranchId = role === ROLES.BRANCH ? branchId : filterBranchId;
    return this.hqCommissionItemRepository.findPending(tenantId, effectiveBranchId);
  }
}
