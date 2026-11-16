require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

if (!process.env.JWT_SECRET && !isTest) {
  console.error('Missing JWT_SECRET. Copy .env.example to .env and set it.');
  process.exit(1);
}

// "0", "false" or blank mean no proxy. A number means that many proxies. Anything else is passed through.
function parseTrustProxy(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v || v === '0' || v === 'false') return 0;
  return /^\d+$/.test(v) ? Number(v) : raw.trim();
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'test-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  allowedEmailDomain: (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase(),
  dbPath: process.env.DB_PATH || './data/dedications.db',
};
