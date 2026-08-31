import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';
import { ConflictError, BusinessRuleError } from '../../../domain/errors';

export default class CreateBranch {
  branchRepository: any;
  tenantRepository: any;
  auditService: any;

  constructor(deps: any) {
    this.branchRepository = deps.branchRepository;
    this.tenantRepository = deps.tenantRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, name, code, type, contactPerson, address, city, state, pincode, isSpecific, workingHours, createdBy, actorName, actorUsername } = params;

    const existing = await this.branchRepository.findByCode(tenantId, code);
    if (existing) throw new ConflictError(`Branch code '${code.toUpperCase()}' already exists`);

    if (isSpecific) {
      const alreadyHasSpecific = await this.branchRepository.hasSpecificBranch(tenantId);
      if (alreadyHasSpecific) throw new ConflictError('A specific branch already exists for this company');
    }

    if (type !== 'head_office') {
      const tenant = await this.tenantRepository.findById(tenantId);
      if (tenant && tenant.branchLimit != null) {
        const count = await this.branchRepository.countNonHeadOffice(tenantId);
        if (count >= tenant.branchLimit) {
          throw new BusinessRuleError(
            `Branch limit reached. This company allows a maximum of ${tenant.branchLimit} branch${tenant.branchLimit === 1 ? '' : 'es'}.`
          );
        }
      }
    }

    const branch = await this.branchRepository.create({
      tenantId, name, code: code.toUpperCase(), type, contactPerson, address, city, state, pincode, isSpecific: !!isSpecific, createdBy,
      ...(workingHours && { workingHours }),
    });

    this.auditService.log({
      tenantId, userId: createdBy, actorName, actorUsername,
      action: AUDIT_ACTIONS.CREATE,
      module: MODULES.BRANCH, entityId: branch._id.toString(),
      after: { name: branch.name, code: branch.code, type: branch.type, city: branch.city, state: branch.state },
    });

    return branch;
  }
}
