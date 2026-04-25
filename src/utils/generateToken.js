const jwt = require('jsonwebtoken');

const generateToken = (id, role = 'user') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign(
    { 
      id, 
      role,
      type: 'access'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d',
      issuer: 'pg-finder-api',
      audience: 'pg-finder-client'
    }
  );
};

const generateRefreshToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign(
    { 
      id,
      type: 'refresh'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
      issuer: 'pg-finder-api',
      audience: 'pg-finder-client'
    }
  );
};

// Verify token function
const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error(`Invalid token: ${error.message}`);
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Token is not a refresh token');
    }
    return decoded;
  } catch (error) {
    throw new Error(`Invalid refresh token: ${error.message}`);
  }
};

// Decode token without verification (for debugging)
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    throw new Error(`Cannot decode token: ${error.message}`);
  }
};

module.exports = { 
  generateToken, 
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  decodeToken 
};
