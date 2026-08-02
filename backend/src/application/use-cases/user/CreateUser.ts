import bcrypt from 'bcryptjs';
import { AUDIT_ACTIONS, MODULES, ROLES } from '../../../config/constants';
import { ConflictError, ValidationError, BusinessRuleError } from '../../../domain/errors';

export default class CreateUser {
  userRepository: any;
  branchRepository: any;
  tenantRepository: any;
  auditService: any;

  constructor(deps: any) {
    this.userRepository = deps.userRepository;
    this.branchRepository = deps.branchRepository;
    this.tenantRepository = deps.tenantRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, username, password, role, branchId, name, loginAllowedFrom, loginAllowedTo, createdBy, actorName, actorUsername } = params;

    const exists = await this.userRepository.usernameExists(tenantId, username);
    if (exists) throw new ConflictError(`Username '${username}' is already taken`);

    // Fetch tenant once — used for staff limit check and employeeId generation
    let tenant: any = null;
    if (this.tenantRepository) {
      tenant = await this.tenantRepository.findById(tenantId);
      if (tenant && tenant.staffLimit) {
        const staffCount = await this.userRepository.countActiveByTenant(tenantId);
        if (staffCount >= tenant.staffLimit) {
          throw new BusinessRuleError(`Staff limit of ${tenant.staffLimit} reached for this company. Contact super admin to increase the limit.`);
        }
      }
    }

    // Branch-assigned roles must have a branchId
    const needsBranch = role === ROLES.BRANCH;
    if (needsBranch && !branchId) {
      throw new ValidationError('branchId is required for this role', 'branchId');
    }
    let branchDoc: any = null;
    if (needsBranch && branchId) {
      branchDoc = await this.branchRepository.findById(tenantId, branchId);
      if (!branchDoc) throw new ValidationError('Branch not found', 'branchId');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Generate employeeId
    let employeeId: string;
    if (!this.tenantRepository || !tenant) {
      employeeId = `STAFF-${username.toUpperCase()}`;
    } else if (role === ROLES.SUPER_ADMIN) {
      employeeId = `SA-${username.toUpperCase()}`;
    } else if (role === ROLES.HEAD_OFFICE) {
      employeeId = `${(tenant.slug || 'co').toUpperCase()}-HO-${username.toUpperCase()}`;
    } else {
      // BRANCH role
      employeeId = `${(tenant.slug || 'co').toUpperCase()}-${(branchDoc?.code || 'BR').toUpperCase()}-${username.toUpperCase()}`;
    }

    const user = await this.userRepository.create({
      tenantId, username: username.toLowerCase(), passwordHash, role,
      branchId: needsBranch ? branchId : null,
      name, loginAllowedFrom, loginAllowedTo, createdBy, employeeId,
      status: 'disabled',
    });

    const { passwordHash: _, ...safeUser } = user;

    this.auditService.log({
      tenantId, userId: createdBy, actorName, actorUsername,
      action: AUDIT_ACTIONS.CREATE,
      module: MODULES.USER, entityId: user._id.toString(),
      after: { username, role, name },
    });

    return safeUser;
  }
}
