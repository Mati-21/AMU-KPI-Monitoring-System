import jwt from 'jsonwebtoken';

/**
 * Generates JWT access token with user identifier and optional claims
 */
export const generateToken = (userId, extraClaims = {}) => {
  const payload = Object.assign({ id: userId }, extraClaims || {});
  return jwt.sign(payload, process.env.JWT_SECRET || 'amu_kpi_jwt_secret', {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

export default generateToken;
