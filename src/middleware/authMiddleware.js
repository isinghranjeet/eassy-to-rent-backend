const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');

// ✅ PROTECT ROUTE
const protect = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return errorResponse(res, {
        statusCode: 500,
        message: 'JWT configuration error',
      });
    }

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Not authorized, no token',
      });
    }

    // ✅ VERIFY TOKEN
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ IMPORTANT: consistent field
    const userId = decoded.id;

    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Invalid token payload',
      });
    }

    // ✅ SET MINIMAL USER (FAST + SAFE)
    req.user = {
      _id: userId,
      role: decoded.role || 'user'
    };

    // ✅ DEBUG (VERY IMPORTANT)
    console.log("AUTH USER:", req.user);

    next();

  } catch (err) {
    return errorResponse(res, {
      statusCode: 401,
      message: 'Not authorized, token invalid',
    });
  }
};



// ✅ ADMIN ONLY
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  return errorResponse(res, {
    statusCode: 403,
    message: 'Admin access required',
  });
};



// ✅ OWNER OR ADMIN
const ownerOrAdmin = (req, res, next) => {
  if (req.user && ['owner', 'admin'].includes(req.user.role)) {
    return next();
  }

  return errorResponse(res, {
    statusCode: 403,
    message: 'Owner or admin access required',
  });
};


module.exports = { protect, adminOnly, ownerOrAdmin };