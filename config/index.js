const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback_development_secret_only_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  cookieSecret: process.env.COOKIE_SECRET || 'cookie_secret_fallback_key',
  get dbPath() {
    return process.env.DATABASE_PATH || path.resolve(__dirname, '../data/platform.db');
  },
  adminInitialEmail: process.env.ADMIN_INITIAL_EMAIL || 'admin@platform.local',
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || 'SuperAdmin@2026Secure!',
  webhookSecret: process.env.WEBHOOK_SECRET || 'whsec_test_secret_key_antigravity_99',
  security: {
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    sessionExpiryHours: 24,
    passwordResetExpiryMinutes: 60,
    emailVerificationExpiryHours: 48,
    rateLimitWindowMs: 15 * 60 * 1000,
    rateLimitMaxRequests: 100
  }
};
