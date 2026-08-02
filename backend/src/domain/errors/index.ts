export class DomainError extends Error {
  code: string;
  statusCode?: number;
  field?: string | null;

  constructor(message: string, code?: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code || this.constructor.name.toUpperCase().replace('ERROR', '');
  }
}

export class ValidationError extends DomainError {
  field: string | null;
  statusCode: number;

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.field = field || null;
    this.statusCode = 422;
  }
}

export class NotFoundError extends DomainError {
  statusCode: number;

  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND');
    this.statusCode = 404;
  }
}

export class ConflictError extends DomainError {
  statusCode: number;

  constructor(message: string) {
    super(message, 'CONFLICT');
    this.statusCode = 409;
  }
}

export class UnauthorizedError extends DomainError {
  statusCode: number;

  constructor(message?: string) {
    super(message || 'Unauthorized', 'UNAUTHORIZED');
    this.statusCode = 401;
  }
}

export class ForbiddenError extends DomainError {
  statusCode: number;

  constructor(message?: string) {
    super(message || 'Access denied', 'FORBIDDEN');
    this.statusCode = 403;
  }
}

export class BusinessRuleError extends DomainError {
  statusCode: number;

  constructor(message: string) {
    super(message, 'BUSINESS_RULE_VIOLATION');
    this.statusCode = 422;
  }
}

export class AccountDisabledError extends DomainError {
  statusCode: number;

  constructor(message?: string) {
    super(message || 'Account has been disabled', 'ACCOUNT_DISABLED');
    this.statusCode = 401;
  }
}

export class AccountSuspendedError extends DomainError {
  statusCode: number;

  constructor(message?: string) {
    super(message || 'Account has been permanently suspended', 'ACCOUNT_SUSPENDED');
    this.statusCode = 403;
  }
}

export class DeviceNotAuthorizedError extends DomainError {
  statusCode: number;

  constructor() {
    super('This device is not authorized to access this account', 'DEVICE_NOT_AUTHORIZED');
    this.statusCode = 401;
  }
}
