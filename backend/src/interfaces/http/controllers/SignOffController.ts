export default class SignOffController {
  signOffUser: any;
  getSignOffStatus: any;
  getDaySignOffs: any;
  enableReLogin: any;

  constructor(deps: any) {
    this.signOffUser    = deps.signOffUser;
    this.getSignOffStatus = deps.getSignOffStatus;
    this.getDaySignOffs = deps.getDaySignOffs;
    this.enableReLogin  = deps.enableReLogin;
  }

  // POST /sign-off — branch staff signs off for today
  signOff = async (req: any, res: any) => {
    const result = await this.signOffUser.execute({
      tenantId: req.user.tenantId,
      userId:   req.user.id,
    });
    res.json({ success: true, data: result });
  };

  // GET /sign-off/status?slug=xyz&userId=abc — public, no auth
  getStatus = async (req: any, res: any) => {
    const { slug, userId } = req.query;
    if (!slug || !userId) {
      return res.json({ success: true, data: { signedOff: false, reLoginEnabled: false } });
    }
    const result = await this.getSignOffStatus.execute({ tenantSlug: slug, userId });
    res.json({ success: true, data: result });
  };

  // GET /sign-offs?date=YYYY-MM-DD — HO: list sign-offs for a day
  list = async (req: any, res: any) => {
    const records = await this.getDaySignOffs.execute({
      tenantId: req.user.tenantId,
      date: req.query.date || null,
    });
    res.json({ success: true, data: records });
  };

  // PATCH /sign-offs/:id/enable — HO: enable re-login
  enable = async (req: any, res: any) => {
    const record = await this.enableReLogin.execute({
      tenantId:  req.user.tenantId,
      signOffId: req.params.id,
      enabledBy: req.user.id,
    });
    res.json({ success: true, data: record });
  };
}
