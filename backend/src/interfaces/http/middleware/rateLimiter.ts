import rateLimit from 'express-rate-limit';

export const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // stricter for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many login attempts, please try again later' } },
});
