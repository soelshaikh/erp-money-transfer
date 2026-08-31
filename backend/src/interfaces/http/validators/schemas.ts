import Joi from 'joi';
import { ROLES, COMMISSION_TYPE, PAYMENT_METHOD, COMMISSION_SIDE, BUSINESS_TYPE } from '../../../config/constants';
import { BRANCH_TYPES } from '../../../domain/entities/Branch';

const objectId = Joi.string().hex().length(24);
const hhmm = Joi.string().pattern(/^\d{2}:\d{2}$/);

const commissionSplit = Joi.object({
  branchPct: Joi.number().min(0).max(50).required(),
  headOfficePct: Joi.number().min(0).max(100).required(),
}).custom((value, helpers) => {
  if (2 * value.branchPct + value.headOfficePct !== 100) {
    return helpers.message({ 'any.invalid': '2× Branch % + Head Office % must equal 100' });
  }
  return value;
});

export const schemas: Record<string, Joi.Schema> = {
  // Auth
  login: Joi.object({
    tenantSlug: Joi.string().required(),
    username: Joi.string().min(3).max(50).required(),
    password: Joi.string().min(6).required(),
    deviceId: Joi.string().max(200).optional(),
    deviceName: Joi.string().max(200).optional(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),

  // Branch
  createBranch: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    code: Joi.string().min(2).max(10).alphanum().required(),
    type: Joi.string().valid(...Object.values(BRANCH_TYPES)).required(),
    contactPerson: Joi.string().min(2).max(100).required(),
    address: Joi.string().max(300).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    pincode: Joi.string().length(6).pattern(/^\d+$/).optional(),
    isSpecific: Joi.boolean().optional(),
    workingHours: Joi.object({
      enabled: Joi.boolean().required(),
      startTime: hhmm.optional().allow(null, ''),
      endTime:   hhmm.optional().allow(null, ''),
    }).optional(),
  }),

  updateBranch: Joi.object({
    name: Joi.string().min(2).max(100),
    contactPerson: Joi.string().min(2).max(100),
    address: Joi.string().max(300),
    city: Joi.string().max(100),
    state: Joi.string().max(100),
    pincode: Joi.string().length(6).pattern(/^\d+$/),
    status: Joi.string().valid('active', 'inactive'),
    commissionConfig: Joi.object({
      enabled: Joi.boolean().required(),
      type: Joi.string().valid(...Object.values(COMMISSION_TYPE)),
      value: Joi.number().min(0),
    }),
    masterCommissionPct: Joi.number().min(0).max(100),
    workingHours: Joi.object({
      enabled: Joi.boolean().required(),
      startTime: hhmm.optional().allow(null, ''),
      endTime:   hhmm.optional().allow(null, ''),
    }),
  }).min(1),

  // User
  createUser: Joi.object({
    username: Joi.string().pattern(/^[a-z0-9@_]+$/).min(3).max(30).required(),
    password: Joi.string().min(8).max(72).required(),
    role: Joi.string().valid(...Object.values(ROLES).filter(r => r !== ROLES.SUPER_ADMIN)).required(),
    branchId: objectId.optional(),
    name: Joi.string().min(2).max(100).required(),
    loginAllowedFrom: hhmm.optional(),
    loginAllowedTo: hhmm.optional(),
  }),

  updateUser: Joi.object({
    name: Joi.string().min(2).max(100),
    status: Joi.string().valid('active', 'inactive'),
    loginAllowedFrom: hhmm.allow(null),
    loginAllowedTo: hhmm.allow(null),
    permissions: Joi.object({
      canOverrideCommission: Joi.boolean(),
    }),
  }).min(1),

  resetPassword: Joi.object({
    newPassword: Joi.string().min(8).max(72).required(),
  }),

  addDevice: Joi.object({
    deviceId: Joi.string().max(200).required(),
    deviceName: Joi.string().max(200).optional(),
  }),

  // Transaction
  createTransaction: Joi.object({
    collectionBranchId: objectId.required(),
    payoutBranchId: objectId.required(),
    amount: Joi.number().positive().max(10000000).required(),
    commissionSide: Joi.string().valid(...Object.values(COMMISSION_SIDE)).default(COMMISSION_SIDE.COLLECTION),
    remarks: Joi.string().max(500).optional().allow('', null),
    paymentMethod: Joi.string().valid(...Object.values(PAYMENT_METHOD)).default('cash'),
    collectionPhotoUrl: Joi.string().uri().optional().allow('', null),
    customerTokenNo: Joi.string().max(100).optional().allow('', null),
    externalAccountId: objectId.optional().allow(null),
    payoutExternalAccountId: objectId.optional().allow(null),
    commissionOverride: Joi.object({
      type: Joi.string().valid(...Object.values(COMMISSION_TYPE)).required(),
      value: Joi.number().min(0).required(),
    }).optional(),
  }),

  rejectTransaction: Joi.object({
    remarks: Joi.string().min(3).max(500).required(),
  }),

  completePayment: Joi.object({
    payoutPhotoUrl: Joi.string().uri().optional().allow('', null),
    commissionDeducted: Joi.boolean().optional(),
  }),

  // Tenant
  createTenant: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    slug: Joi.string().lowercase().min(3).max(50).pattern(/^[a-z0-9-]+$/).required(),
    contactEmail: Joi.string().email().optional().allow(''),
    address: Joi.string().max(300).optional().allow(''),
    branchLimit: Joi.number().integer().min(1).max(9999).required(),
    businessType: Joi.string().valid(...Object.values(BUSINESS_TYPE)).required(),
    branding: Joi.object({
      appName: Joi.string().max(100).optional(),
      logoUrl: Joi.string().uri().optional().allow(''),
      primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
      secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    }).optional(),
  }),

  updateTenantStatus: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'suspended').required(),
  }),

  updateTenantBranchLimit: Joi.object({
    branchLimit: Joi.number().integer().min(1).max(9999).required(),
  }),

  updateTenantStaffLimit: Joi.object({
    staffLimit: Joi.number().integer().min(1).max(9999).required(),
  }),

  updateTenantTransactionLimits: Joi.object({
    maxAmountPerTransaction: Joi.number().min(0),
    dailyLimitPerBranch: Joi.number().min(0),
  }).min(1),

  updateTenantCommission: Joi.object({
    commission: Joi.object({
      type: Joi.string().valid('flat', 'percentage').required(),
      value: Joi.number().min(0).required(),
    }).required(),
  }),

  updateTenantBusinessType: Joi.object({
    businessType: Joi.string().valid(...Object.values(BUSINESS_TYPE)).required(),
  }),

  updateTenantCommissionSplit: Joi.object({
    commissionSplit: commissionSplit.required(),
  }),

  createHeadOfficeUser: Joi.object({
    username: Joi.string().pattern(/^[a-z0-9@_]+$/).min(3).max(30).required(),
    password: Joi.string().min(8).max(72).required(),
    name: Joi.string().min(2).max(100).required(),
  }),

  // HQ Commission
  createHQSettlement: Joi.object({
    branchId: objectId.optional(), // required when HO initiates; ignored for branch role
    itemIds: Joi.array().items(objectId.required()).min(1).required(),
    paymentMode: Joi.string().valid(...Object.values(PAYMENT_METHOD)).required(),
    notes: Joi.string().max(500).optional().allow('', null),
  }),

  // Settings
  updateSettings: Joi.object({
    branding: Joi.object({
      appName: Joi.string().max(100),
      logoUrl: Joi.string().uri().allow('', null),
      primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
      secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    }),
    features: Joi.object({
      customerVerification: Joi.boolean(),
      reportExport: Joi.boolean(),
    }),
    settings: Joi.object({
      commission: Joi.object({
        type: Joi.string().valid(...Object.values(COMMISSION_TYPE)),
        value: Joi.number().min(0),
      }),
      commissionSplit,
      timezone: Joi.string().max(50),
      loginTimeRestriction: Joi.boolean(),
      transactionLimits: Joi.object({
        maxAmountPerTransaction: Joi.number().min(0).optional(),
        dailyLimitPerBranch: Joi.number().min(0).optional(),
      }).optional(),
      workingHours: Joi.object({
        enabled: Joi.boolean().required(),
        startTime: hhmm.optional().allow(null, ''),
        endTime:   hhmm.optional().allow(null, ''),
      }).optional(),
    }),
  }).min(1),

  updateBranchWorkingHours: Joi.object({
    workingHours: Joi.object({
      enabled: Joi.boolean().required(),
      startTime: hhmm.optional().allow(null, ''),
      endTime:   hhmm.optional().allow(null, ''),
    }).required(),
  }),
};

function humanizeJoiMessage(detail: Joi.ValidationErrorItem): string {
  const field = detail.path.join('.');
  const label = field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

  switch (detail.type) {
    case 'string.empty':
    case 'any.required':
      return `${label} is required`;
    case 'string.min':
      return `${label} must be at least ${detail.context?.limit} characters`;
    case 'string.max':
      return `${label} must be at most ${detail.context?.limit} characters`;
    case 'string.pattern.base':
      return `${label} format is invalid`;
    case 'string.email':
      return `${label} must be a valid email`;
    case 'string.length':
      return `${label} must be exactly ${detail.context?.limit} characters`;
    case 'number.base':
      return `${label} must be a valid number`;
    case 'number.min':
      return `${label} must be at least ${detail.context?.limit}`;
    case 'number.max':
      return `${label} must be at most ${detail.context?.limit}`;
    case 'array.min':
      return `${label} must have at least ${detail.context?.limit} item(s)`;
    default:
      // Strip the Joi-style quoted field prefix ("fieldName" ...) and capitalise
      return detail.message
        .replace(/^"[^"]*"\s*/, '')
        .replace(/^./, (c) => c.toUpperCase());
  }
}

/**
 * Middleware factory — validates req.body against a named schema.
 * Returns 422 with human-readable field-level errors on failure.
 */
export function validate(schemaName: string) {
  return (req: any, res: any, next: any) => {
    const schema = schemas[schemaName];
    if (!schema) return next(new Error(`Unknown validation schema: ${schemaName}`));
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map((d: any) => ({
        field: d.path.join('.'),
        message: humanizeJoiMessage(d),
      }));
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: details.map((d: any) => d.message).join('. '),
          details,
        },
      });
    }
    req.body = value;
    next();
  };
}
