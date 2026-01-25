const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // 1️⃣ Check Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1]; // Bearer <token>
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    // 2️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // 3️⃣ Get user from DB
    // ⚠️ Make sure JWT payload has "id" field or "userId"
    const userId = decoded.id || decoded.userId;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // 4️⃣ Attach user to request
    req.user = user;
    next();

  } catch (error) {
    console.error('Protect middleware error:', error.message);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// ✅ Admin only
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// ✅ Owner or Admin
const owner = (req, res, next) => {
  if (req.user && ['owner', 'admin'].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ error: 'Owner access required' });
  }
};

module.exports = { protect, adminOnly, owner };
