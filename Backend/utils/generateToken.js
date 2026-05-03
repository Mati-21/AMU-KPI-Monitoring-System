const jwt = require('jsonwebtoken');

const generateToken = (Id, extraClaims = {}) => {
  const payload = Object.assign({ Id }, extraClaims || {});
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

module.exports = generateToken;
