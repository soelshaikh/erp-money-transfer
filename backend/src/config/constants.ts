export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  HEAD_OFFICE: 'head_office',
  BRANCH: 'branch',
} as const);

export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const);

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
} as const);

export const PAYMENT_METHOD = Object.freeze({
  CASH: 'cash',
  NEFT: 'neft',
  RTGS: 'rtgs',
  BANK_TRANSFER: 'bank_transfer',
} as const);

export const COMMISSION_TYPE = Object.freeze({
  FLAT: 'flat',
  PERCENTAGE: 'percentage',
} as const);

export const COMMISSION_SIDE = Object.freeze({
  COLLECTION: 'collection',
  PAYOUT: 'payout',
} as const);

export const DEVICE_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected',
} as const);

export const NOTIFICATION_TYPE = Object.freeze({
  TRANSACTION_CREATED: 'transaction_created',
  TRANSACTION_APPROVED: 'transaction_approved',
  TRANSACTION_REJECTED: 'transaction_rejected',
  PAYMENT_COMPLETED: 'payment_completed',
  DEVICE_REGISTERED: 'device_registered',
  DEVICE_PENDING_APPROVAL: 'device_pending_approval',
} as const);

export const AUDIT_ACTIONS = Object.freeze({
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SUSPEND: 'SUSPEND',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  EXPORT: 'EXPORT',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PAYMENT_COMPLETE: 'PAYMENT_COMPLETE',
  COMMISSION_OVERRIDE: 'COMMISSION_OVERRIDE',
  DEVICE_APPROVE: 'DEVICE_APPROVE',
  DEVICE_REJECT: 'DEVICE_REJECT',
  DEVICE_SUSPEND: 'DEVICE_SUSPEND',
} as const);

export const MODULES = Object.freeze({
  AUTH: 'Auth',
  USER: 'User',
  BRANCH: 'Branch',
  CUSTOMER: 'Customer',
  TRANSACTION: 'Transaction',
  REPORT: 'Report',
  SETTINGS: 'Settings',
  TENANT: 'Tenant',
  DEVICE: 'Device',
} as const);

export const ID_PROOF_TYPES = Object.freeze(['aadhar', 'pan', 'passport', 'voter_id', 'driving_license', 'other']);
