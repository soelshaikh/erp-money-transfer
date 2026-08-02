import mongoose from 'mongoose';

/**
 * Stores idempotency keys with 24-hour TTL.
 * The `response` field caches the exact HTTP response so replay returns same body+status.
 */
const idempotencySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  key: { type: String, required: true }, // Idempotency-Key header value
  statusCode: { type: Number, required: true },
  response: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 }, // TTL: 24h
}, {
  collection: 'idempotency_keys',
});

idempotencySchema.index({ tenantId: 1, key: 1 }, { unique: true });

export default mongoose.model('Idempotency', idempotencySchema);
