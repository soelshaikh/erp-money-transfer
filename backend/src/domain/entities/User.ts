import { ROLES } from '../../config/constants';
import { BusinessRuleError } from '../errors';

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
  SUSPENDED: 'suspended',
});

export class User {
  id: any;
  tenantId: any;
  username: any;
  passwordHash: any;
  role: any;
  branchId: any;
  name: any;
  status: any;
  loginAllowedFrom: any;
  loginAllowedTo: any;
  lastLoginAt: any;
  createdBy: any;
  createdAt: any;
  updatedAt: any;

  constructor(data: any) {
    this.id = data.id || null;
    this.tenantId = data.tenantId;
    this.username = data.username;
    this.passwordHash = data.passwordHash;
    this.role = data.role;
    this.branchId = data.branchId || null; // null for super_admin & admin roles
    this.name = data.name;
    this.status = data.status || USER_STATUS.ACTIVE;
    this.loginAllowedFrom = data.loginAllowedFrom || null; // "HH:MM" e.g. "09:00"
    this.loginAllowedTo = data.loginAllowedTo || null;     // "HH:MM" e.g. "18:00"
    this.lastLoginAt = data.lastLoginAt || null;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt || null;
    this.updatedAt = data.updatedAt || null;
  }

  isActive(): boolean {
    return this.status === USER_STATUS.ACTIVE;
  }

  isSuperAdmin(): boolean {
    return this.role === ROLES.SUPER_ADMIN;
  }

  isAdmin(): boolean {
    return (this.role as any) === (ROLES as any).ADMIN;
  }

  requiresBranch(): boolean {
    return this.role === ROLES.BRANCH;
  }

  /**
   * Check if current time (UTC minutes from midnight) is within login window.
   * loginAllowedFrom/To are stored as "HH:MM" strings.
   */
  isWithinLoginHours(nowHHMM: any): boolean {
    if (!this.loginAllowedFrom || !this.loginAllowedTo) return true; // no restriction
    return nowHHMM >= this.loginAllowedFrom && nowHHMM <= this.loginAllowedTo;
  }

  deactivate(): this {
    if (!this.isActive()) throw new BusinessRuleError('User is already inactive');
    this.status = USER_STATUS.INACTIVE;
    return this;
  }

  activate(): this {
    if (this.isActive()) throw new BusinessRuleError('User is already active');
    this.status = USER_STATUS.ACTIVE;
    return this;
  }
}
