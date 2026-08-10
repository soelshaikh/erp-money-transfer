import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { validate } from '../validators/schemas';
import { ROLES } from '../../../config/constants';

export default function tenantRoutes(tenantController: any) {
  const router = Router();

  router.use(authenticate);
  router.use(authorize(ROLES.SUPER_ADMIN));

  router.delete('/reset-dev-data', tenantController.resetDev);
  router.get('/', tenantController.list);
  router.get('/:id/branches', tenantController.listTenantBranches);
  router.get('/:id/users', tenantController.listTenantUsers);
  router.get('/:tenantId/users/:userId/devices', tenantController.listUserDevices);
  router.post('/:tenantId/users/:userId/devices', validate('addDevice'), tenantController.addUserDevice);
  router.delete('/:tenantId/users/:userId/devices/:deviceId', tenantController.removeUserDevice);
  router.get('/:id', tenantController.getOne);
  router.post('/', validate('createTenant'), tenantController.create);
  router.patch('/:id/status', validate('updateTenantStatus'), tenantController.updateStatus);
  router.patch('/:id/branch-limit', validate('updateTenantBranchLimit'), tenantController.updateBranchLimit);
  router.patch('/:id/staff-limit', validate('updateTenantStaffLimit'), tenantController.updateStaffLimit);
  router.patch('/:id/transaction-limits', validate('updateTenantTransactionLimits'), tenantController.updateTransactionLimits);
  router.patch('/:id/commission', validate('updateTenantCommission'), tenantController.updateCommission);
  router.patch('/:id/export-formats', tenantController.updateExportFormats);
  router.patch('/:id/credit-commission-flag', tenantController.updateCreditCommissionFlag);
  router.patch('/:id/device-approval', tenantController.updateDeviceApproval);
  router.post('/:id/head-office', validate('createHeadOfficeUser'), tenantController.createHeadOffice);

  return router;
}
