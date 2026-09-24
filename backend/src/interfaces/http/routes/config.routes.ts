import { Router } from 'express';
import { NotFoundError } from '../../../domain/errors';

const DEFAULT_API_URL = process.env.API_URL || 'https://erp-money-transfer.onrender.com/api/v1';

export default function configRoutes(tenantRepository: any) {
  const router = Router();

  // Public — no auth. Mobile calls this on slug entry to resolve the company's backend URL.
  router.get('/tenant/:slug', async (req: any, res: any, next: any) => {
    try {
      const slug = req.params.slug?.toLowerCase().trim();
      if (!slug) return next(new NotFoundError('Company'));

      const tenant = await tenantRepository.findBySlug(slug);
      if (!tenant) return next(new NotFoundError('Company'));

      res.json({
        success: true,
        data: {
          apiUrl:      tenant.apiUrl || DEFAULT_API_URL,
          status:      tenant.status,
          companyName: tenant.name,
          appName:     tenant.branding?.appName || tenant.name,
          primaryColor: tenant.branding?.primaryColor || '#1A73E8',
          logoUrl:     tenant.branding?.logoUrl || null,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
