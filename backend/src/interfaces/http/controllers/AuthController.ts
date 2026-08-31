export default class AuthController {
  private loginUseCase: any;
  private refreshTokenUseCase: any;
  private tenantRepository: any;

  constructor({ loginUseCase, refreshTokenUseCase, tenantRepository }: any) {
    this.loginUseCase = loginUseCase;
    this.refreshTokenUseCase = refreshTokenUseCase;
    this.tenantRepository = tenantRepository;
    this.login = this.login.bind(this);
    this.refresh = this.refresh.bind(this);
    this.validateCompany = this.validateCompany.bind(this);
    this.me = this.me.bind(this);
  }

  async login(req: any, res: any) {
    const result = await this.loginUseCase.execute({
      ...req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(200).json({ success: true, data: result });
  }

  async refresh(req: any, res: any) {
    const result = await this.refreshTokenUseCase.execute(req.body);
    res.status(200).json({ success: true, data: result });
  }

  async me(req: any, res: any) {
    const tenant = await this.tenantRepository.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false });
    res.json({
      success: true,
      data: {
        user: {
          _id: req.user.id,
          name: req.user.name,
          username: req.user.username,
          role: req.user.role,
          branchId: req.user.branchId,
          permissions: req.user.permissions,
        },
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          branding: tenant.branding,
          features: tenant.features,
          settings: { timezone: tenant.settings?.timezone },
          staffLimit: tenant.staffLimit,
          businessType: tenant.businessType,
        },
      },
    });
  }

  async validateCompany(req: any, res: any) {
    const { slug } = req.query;
    if (!slug || typeof slug !== 'string') {
      return res.json({ success: true, data: { valid: false } });
    }
    const tenant = await this.tenantRepository.findBySlug(slug.trim().toLowerCase());
    if (!tenant) {
      return res.json({ success: true, data: { valid: false } });
    }
    res.json({ success: true, data: { valid: true, name: tenant.name, status: tenant.status } });
  }
}
