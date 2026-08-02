import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../../../config/env';
import { AUDIT_ACTIONS, DEVICE_STATUS, MODULES, ROLES } from '../../../config/constants';
import { UnauthorizedError, ForbiddenError, AccountDisabledError, AccountSuspendedError } from '../../../domain/errors';

export default class Login {
  userRepository: any;
  tenantRepository: any;
  branchRepository: any;
  auditService: any;
  notificationService: any;
  createDeviceSession: any;

  constructor(deps: any) {
    this.userRepository = deps.userRepository;
    this.tenantRepository = deps.tenantRepository;
    this.branchRepository = deps.branchRepository;
    this.auditService = deps.auditService;
    this.notificationService = deps.notificationService || null;
    this.createDeviceSession = deps.createDeviceSession || null;
  }

  async execute(params: any): Promise<any> {
    const { tenantSlug, username, password, ip, userAgent } = params;

    const tenant = await this.tenantRepository.findBySlug(tenantSlug);
    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedError('Invalid credentials');
    }

    const user = await this.userRepository.findByUsername(tenant._id, username);
    if (!user) throw new UnauthorizedError('Invalid credentials');
    if (user.status === 'disabled') throw new AccountDisabledError('Your account has been temporarily disabled. Contact your administrator.');
    if (user.status !== 'active') throw new AccountSuspendedError('Your account has been permanently suspended. Contact head office.');

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedError('Invalid credentials');

    // Check branch status for branch-role users
    if (user.role === ROLES.BRANCH && user.branchId) {
      const branch = await this.branchRepository.findById(tenant._id, user.branchId);
      if (!branch || branch.status !== 'active') {
        throw new ForbiddenError('Your branch is currently disabled. Contact head office.');
      }
    }

    // Login time restriction check
    if (tenant.settings?.loginTimeRestriction) {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5); // "HH:MM"
      if (!this._withinHours(user, hhmm)) {
        throw new ForbiddenError('Login not allowed at this time');
      }
    }

    // Device session check — skip only for super_admin or if no deviceId sent
    if (user.role !== ROLES.SUPER_ADMIN && params.deviceId && this.createDeviceSession) {
      const deviceApprovalRequired = !!tenant.features?.deviceApprovalRequired;
      const { deviceStatus } = await this.createDeviceSession.execute({
        tenantId:    tenant._id,
        userId:      user._id,
        deviceId:    params.deviceId,
        deviceName:  params.deviceName || 'Unknown Device',
        platform:    params.platform || 'unknown',
        ip:          params.ip,
        userAgent:   params.userAgent,
        userName:    user.name,
        autoApprove: !deviceApprovalRequired,
      });

      // Only block login access when deviceApprovalRequired is ON and device is not yet approved
      if (deviceApprovalRequired && deviceStatus !== DEVICE_STATUS.APPROVED) {
        const { passwordHash: _, otpHash: __, ...safeUser } = user;
        return {
          deviceStatus,
          user: safeUser,
          tenant: {
            id: tenant._id,
            name: tenant.name,
            slug: tenant.slug,
            branding: tenant.branding,
            features: tenant.features,
            settings: { timezone: tenant.settings?.timezone },
            staffLimit: tenant.staffLimit,
          },
        };
      }
    }

    const tokenPayload = {
      sub: user._id.toString(),
      tenantId: tenant._id.toString(),
      role: user.role,
      branchId: user.branchId ? user.branchId.toString() : null,
    };

    const accessToken = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: 'HS256',
    });

    const refreshToken = jwt.sign(
      { sub: user._id.toString(), tenantId: tenant._id.toString() },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN, algorithm: 'HS256' }
    );

    // Fire-and-forget — don't block login on audit/lastLogin writes
    this.userRepository.updateLastLogin(tenant._id, user._id).catch(() => {});
    this.auditService.log({
      tenantId: tenant._id,
      userId: user._id,
      actorName: user.name,
      actorUsername: user.username,
      action: AUDIT_ACTIONS.LOGIN,
      module: MODULES.AUTH,
      ip,
      userAgent,
      after: { username: user.username, name: user.name, role: user.role },
    });

    const { passwordHash: _, otpHash: __, ...safeUser } = user;

    return {
      deviceStatus: DEVICE_STATUS.APPROVED,
      accessToken,
      refreshToken,
      user: safeUser,
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        branding: tenant.branding,
        features: tenant.features,
        settings: { timezone: tenant.settings?.timezone },
        staffLimit: tenant.staffLimit,
      },
    };
  }

  _withinHours(user: any, hhmm: any): boolean {
    if (!user.loginAllowedFrom || !user.loginAllowedTo) return true;
    return hhmm >= user.loginAllowedFrom && hhmm <= user.loginAllowedTo;
  }
}
