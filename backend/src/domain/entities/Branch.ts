import { ROLES } from '../../config/constants';
import { BusinessRuleError } from '../errors';

export const BRANCH_TYPES = Object.freeze({ COLLECTION: 'collection', PAYOUT: 'payout', BOTH: 'both', HEAD_OFFICE: 'head_office' });
export const BRANCH_STATUS = Object.freeze({ ACTIVE: 'active', INACTIVE: 'inactive' });

export class Branch {
  id: any;
  tenantId: any;
  name: any;
  code: any;
  type: any;
  contactPerson: any;
  address: any;
  city: any;
  state: any;
  pincode: any;
  status: any;
  createdBy: any;
  createdAt: any;
  updatedAt: any;

  constructor(data: any) {
    this.id = data.id || null;
    this.tenantId = data.tenantId;
    this.name = data.name;
    this.code = data.code; // short unique code e.g. "AHM" — used in token number
    this.type = data.type;
    this.contactPerson = data.contactPerson;
    this.address = data.address;
    this.city = data.city;
    this.state = data.state;
    this.pincode = data.pincode;
    this.status = data.status || BRANCH_STATUS.ACTIVE;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt || null;
    this.updatedAt = data.updatedAt || null;
  }

  isActive(): boolean {
    return this.status === BRANCH_STATUS.ACTIVE;
  }

  isHeadOffice(): boolean {
    return this.type === BRANCH_TYPES.HEAD_OFFICE;
  }

  deactivate(): this {
    if (!this.isActive()) throw new BusinessRuleError('Branch is already inactive');
    this.status = BRANCH_STATUS.INACTIVE;
    return this;
  }

  activate(): this {
    if (this.isActive()) throw new BusinessRuleError('Branch is already active');
    this.status = BRANCH_STATUS.ACTIVE;
    return this;
  }
}
