import 'dotenv/config';

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`[ENV] Missing required environment variable: ${key}`);
  return val;
};

const optional = (key: string, defaultVal: string): string => process.env[key] || defaultVal;

// Fail fast at startup — never discover missing env vars at runtime
const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '5000'), 10),

  MONGODB_URI: required('MONGODB_URI'),

  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '15m'),          // access token: short-lived
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),

  SUPER_ADMIN_USERNAME: optional('SUPER_ADMIN_USERNAME', 'superadmin'),
  SUPER_ADMIN_PASSWORD: required('SUPER_ADMIN_PASSWORD'),

  APP_ACCESS_CODE: optional('APP_ACCESS_CODE', ''),

  CLIENT_URL: optional('CLIENT_URL', '*'),
  LOG_LEVEL: optional('LOG_LEVEL', 'info'),

  isProduction: () => env.NODE_ENV === 'production',
  isDevelopment: () => env.NODE_ENV === 'development',
  isTest: () => env.NODE_ENV === 'test',
};

export default env;
