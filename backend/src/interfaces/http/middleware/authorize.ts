import { ForbiddenError } from '../../../domain/errors';

/**
 * Role-based access control. Call after authenticate().
 * Usage: authorize(ROLES.ADMIN, ROLES.HEAD_OFFICE)
 */
export default function authorize(...allowedRoles: any[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) return next(new ForbiddenError('Not authenticated'));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
}
