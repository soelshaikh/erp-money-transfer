import jwt from 'jsonwebtoken';
import env from '../../../config/env';
import { UnauthorizedError, AccountDisabledError } from '../../../domain/errors';
import UserModel from '../../../infrastructure/db/models/User.model';
import TenantModel from '../../../infrastructure/db/models/Tenant.model';
import BranchModel from '../../../infrastructure/db/models/Branch.model';

export default async function authenticate(req: any, res: any, next: any) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing authorization header'));
    }

    const token = header.slice(7);
    let payload: any;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return next(new UnauthorizedError('Invalid or expired token'));
    }

    const [user, tenant, branch] = await Promise.all([
      UserModel.findOne({ _id: payload.sub, tenantId: payload.tenantId }).select('status permissions name username').lean(),
      TenantModel.findById(payload.tenantId).select('status').lean(),
      payload.branchId
        ? BranchModel.findOne({ _id: payload.branchId, tenantId: payload.tenantId }).select('status').lean()
        : Promise.resolve(null),
    ]);

    if (!user || (user as any).status !== 'active') return next(new AccountDisabledError());
    if (!tenant || (tenant as any).status !== 'active') return next(new AccountDisabledError());
    if (payload.branchId && (!branch || (branch as any).status !== 'active')) return next(new AccountDisabledError());

    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      branchId: payload.branchId || null,
      permissions: (user as any).permissions || {},
      name: (user as any).name || null,
      username: (user as any).username || null,
    };
    req.user.ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || (req.socket as any)?.remoteAddress || '';
    next();
  } catch (err) {
    next(err);
  }
}
