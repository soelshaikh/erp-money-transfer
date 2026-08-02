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
