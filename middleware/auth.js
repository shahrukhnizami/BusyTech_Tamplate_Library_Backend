const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  // 🔥 Allow CORS preflight
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid token or user not active' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};


// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Check if user is admin or accessing their own data
const requireAdminOrOwner = (req, res, next) => {
  const userId = req.params.userId || req.body.userId;
  
  if (req.user.role === 'admin' || req.user._id.toString() === userId) {
    return next();
  }
  
  return res.status(403).json({ message: 'Access denied' });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireAdminOrOwner
};