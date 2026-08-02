import IAuditService from '../../application/ports/IAuditService';
import AuditLogModel from '../db/models/AuditLog.model';
import logger from '../../config/logger';

export default class MongoAuditService extends IAuditService {
  async log(entry: any) {
    // Fire-and-forget — never block the main request on audit write failure
    AuditLogModel.create(entry).catch((err) => {
      logger.error({ err, entry }, 'Audit log write failed');
    });
  }
}
