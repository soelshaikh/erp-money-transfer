import IdempotencyModel from '../../../infrastructure/db/models/Idempotency.model';
import logger from '../../../config/logger';

/**
 * Idempotency middleware for mutation endpoints (POST only).
 * If Idempotency-Key header is present and a cached response exists, replay it.
 * After sending the real response, caches it for 24 hours (TTL on model).
 */
export default function idempotency(req: any, res: any, next: any) {
  const key = req.headers['idempotency-key'];
  if (!key || req.method !== 'POST') return next();

  const tenantId = req.user?.tenantId;
  if (!tenantId) return next();

  IdempotencyModel.findOne({ tenantId, key }).lean().then((cached) => {
    if (cached) {
      logger.debug({ key }, 'Idempotency cache hit — replaying response');
      return res.status(cached.statusCode).json(cached.response);
    }

    // Intercept res.json to cache the response after it's sent
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      IdempotencyModel.create({ tenantId, key, statusCode: res.statusCode, response: body })
        .catch((err: any) => logger.error({ err, key }, 'Failed to cache idempotency response'));
      return originalJson(body);
    };

    next();
  }).catch(next);
}
