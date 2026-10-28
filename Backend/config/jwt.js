import 'dotenv/config';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Add it to Backend/.env before starting the server.');
}

const JWT_SECRET = process.env.JWT_SECRET;

export const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRE || '1h';
export const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRE || '7d';
export const STAGE_TOKEN_TTL = '15m';

// Every token carries a `type` claim so one kind can never be replayed as another
// (e.g. a pre-MFA stage token used as a session token).
export const TOKEN_TYPES = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh',
  STAGE: 'stage',
});

const UNIT_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

/**
 * Convert a TTL like "15m", "1h" or "7d" (or plain seconds) to milliseconds for cookie maxAge.
 */
export const ttlToMs = (ttl) => {
  const match = /^(\d+)\s*([smhd])?$/i.exec(String(ttl).trim());
  if (!match) throw new Error(`Invalid token TTL "${ttl}". Use formats like 900, 15m, 1h or 7d.`);
  const unit = (match[2] || 's').toLowerCase();
  return Number(match[1]) * UNIT_MS[unit];
};

export const signToken = (type, payload, expiresIn) => jwt.sign({ ...payload, type }, JWT_SECRET, { expiresIn });

/**
 * Verify a token and assert its type. Throws jsonwebtoken errors or an Error on type mismatch.
 */
export const verifyToken = (token, expectedType) => {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type !== expectedType) {
    const error = new Error('Invalid token type');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  return decoded;
};

export default { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, STAGE_TOKEN_TTL, TOKEN_TYPES, ttlToMs, signToken, verifyToken };
