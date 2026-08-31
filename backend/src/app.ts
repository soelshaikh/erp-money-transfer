import 'express-async-errors';

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import logger from './config/logger';
import { defaultLimiter } from './interfaces/http/middleware/rateLimiter';
import { DomainError } from './domain/errors';

// Route factories
import authRoutes from './interfaces/http/routes/auth.routes';
import branchRoutes from './interfaces/http/routes/branch.routes';
import userRoutes from './interfaces/http/routes/user.routes';
import transactionRoutes from './interfaces/http/routes/transaction.routes';
import tenantRoutes from './interfaces/http/routes/tenant.routes';
import dashboardRoutes from './interfaces/http/routes/dashboard.routes';
import settingsRoutes from './interfaces/http/routes/settings.routes';
import appInstallRoutes from './interfaces/http/routes/app-install.routes';

export default function createApp(container: any) {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(defaultLimiter);

  // Health check — no auth, no rate limit
  app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  // Routes
  app.use('/api/v1/auth', authRoutes(container.authController));
  app.use('/api/v1/branches', branchRoutes(container.branchController));
  app.use('/api/v1/users', userRoutes(container.userController));
  app.use('/api/v1/transactions', transactionRoutes(container.transactionController));
  app.use('/api/v1/tenants', tenantRoutes(container.tenantController));
  app.use('/api/v1/dashboard', dashboardRoutes(container.dashboardController));
  app.use('/api/v1/settings', settingsRoutes(container.settingsController));
  app.use('/api/v1/reports', container.reportRoutes(container.reportController));
  app.use('/api/v1/notifications', container.notificationRoutes());
  app.use('/api/v1/audit-logs', container.auditLogRoutes(container.auditLogController));
  app.use('/api/v1/device-sessions', container.deviceSessionRoutes(container.deviceSessionController));
  app.use('/api/v1/app-install', appInstallRoutes(container.appInstallController));
  app.use('/api/v1/commission-settlements', container.commissionSettlementRoutes(container.commissionSettlementController));
  app.use('/api/v1/hq-commission', container.hqCommissionRoutes(container.hqCommissionController));
  app.use('/api/v1/external-accounts', container.externalAccountRoutes(container.externalAccountController));
  app.use('/api/v1/partner-transfers', container.partnerTransferRoutes(container.partnerTransferController));
  app.use('/api/v1/sign-off', container.signOffRoutes(container.signOffController));

  // 404
  app.use((req: any, res: any) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
  });

  // Global error handler — maps DomainError subclasses to correct HTTP status
  // eslint-disable-next-line no-unused-vars
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof DomainError) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code, message: err.message, field: err.field || undefined },
      });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message },
      });
    }

    // Unexpected error — don't leak internals
    logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  });

  return app;
}
