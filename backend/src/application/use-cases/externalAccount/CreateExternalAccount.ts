import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import { ConflictError } from '../../../domain/errors';

export default class CreateExternalAccount {
  async execute(params: any): Promise<any> {
    const { tenantId, name, code, contactPerson, phone, address, notes, createdBy } = params;

    const existing = await ExternalAccountModel.findOne({ tenantId, code: code.trim().toUpperCase() });
    if (existing) throw new ConflictError(`Partner code '${code.toUpperCase()}' already exists`);

    const account = await ExternalAccountModel.create({
      tenantId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      contactPerson: contactPerson?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
      balance: 0,
      status: 'active',
      createdBy,
    });

    return account;
  }
}
