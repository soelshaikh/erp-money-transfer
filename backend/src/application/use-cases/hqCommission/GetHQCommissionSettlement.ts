import { NotFoundError } from '../../../domain/errors';
import IHQCommissionSettlementRepository from '../../ports/IHQCommissionSettlementRepository';
import IHQCommissionItemRepository from '../../ports/IHQCommissionItemRepository';
import {
  GetHQSettlementParams,
  HQCommissionSettlementWithItems,
} from '../../../domain/types/hqCommission.types';

export default class GetHQCommissionSettlement {
  private hqCommissionSettlementRepository: IHQCommissionSettlementRepository;
  private hqCommissionItemRepository: IHQCommissionItemRepository;

  constructor(deps: {
    hqCommissionSettlementRepository: IHQCommissionSettlementRepository;
    hqCommissionItemRepository: IHQCommissionItemRepository;
  }) {
    this.hqCommissionSettlementRepository = deps.hqCommissionSettlementRepository;
    this.hqCommissionItemRepository = deps.hqCommissionItemRepository;
  }

  async execute(params: GetHQSettlementParams): Promise<HQCommissionSettlementWithItems> {
    const { tenantId, settlementId } = params;

    const settlement = await this.hqCommissionSettlementRepository.findById(tenantId, settlementId);
    if (!settlement) throw new NotFoundError('HQ commission settlement');

    const items = await this.hqCommissionItemRepository.findBySettlement(tenantId, settlement._id.toString());

    return { ...settlement, items };
  }
}
