import jwt from 'jsonwebtoken';
import env from '../../../config/env';
import { UnauthorizedError } from '../../../domain/errors';

export default class RefreshToken {
  userRepository: any;
  tenantRepository: any;
  branchRepository: any;

  constructor(deps: any) {
    this.userRepository = deps.userRepository;
    this.tenantRepository = deps.tenantRepository;
    this.branchRepository = deps.branchRepository;
  }

  async execute(params: any): Promise<any> {
    const { refreshToken } = params;

    let payload: any;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const [user, tenant] = await Promise.all([
      this.userRepository.findById(payload.tenantId, payload.sub),
      this.tenantRepository.findById(payload.tenantId),
    ]);

    if (!user || user.status !== 'active') throw new UnauthorizedError('User inactive or not found');
    if (!tenant || tenant.status !== 'active') throw new UnauthorizedError('Tenant inactive');

    if (user.branchId) {
      const branch = await this.branchRepository.findById(user.tenantId.toString(), user.branchId.toString());
      if (!branch || branch.status !== 'active') throw new UnauthorizedError('Branch inactive');
    }

    const accessToken = jwt.sign(
      {
        sub: user._id.toString(),
        tenantId: tenant._id.toString(),
        role: user.role,
        branchId: user.branchId ? user.branchId.toString() : null,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any, algorithm: 'HS256' }
    );

    return { accessToken };
  }
}
