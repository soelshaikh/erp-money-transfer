import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import { ConflictError, NotFoundError } from '../../../domain/errors';

export default class CreateExternalAccount {
  branchRepository: any;

  constructor(deps: any = {}) {
    this.branchRepository = deps.branchRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, branchId, name, code, contactPerson, phone, address, notes, createdBy } = params;

    if (!branchId) throw new NotFoundError('branchId is required');

    if (this.branchRepository) {
      const branch = await this.branchRepository.findById(tenantId, branchId);
      if (!branch) throw new NotFoundError('Branch not found');
    }

    const existing = await ExternalAccountModel.findOne({ tenantId, code: code.trim().toUpperCase() });
    if (existing) throw new ConflictError(`Partner code '${code.toUpperCase()}' already exists`);

    const account = await ExternalAccountModel.create({
      tenantId,
      branchId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      contactPerson: contactPerson?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
      balance: 0,
      onHold: 0,
      status: 'active',
      createdBy,
    });

    return account;
  }
}
