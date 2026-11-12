// ==============================================================================
// File: backend/middleware/auth.js
// Purpose: JWT authentication and Role-Based Access Control (RBAC) middleware
// ==============================================================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware: protect
 * Purpose: Verify the incoming JSON Web Token (JWT) in the HTTP Authorization header.
 * If valid, attach the authenticated user object to req.user.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Check if the Authorization header exists and follows the Bearer token convention
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract the token string after "Bearer "
      token = req.headers.authorization.split(' ')[1];

      // 2. Verify the token signature and expiration against the JWT secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Find user by id in token payload (exclude hashed password from req.user)
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User belonging to this token no longer exists.',
        });
      }

      // 4. Attach user document to Express request object for downstream controllers
      req.user = user;
      next();
    } catch (error) {
      console.error('[Auth Error]: Invalid or expired token:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Token verification failed or expired.',
      });
    }
  }

  // If no token was provided in the headers
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. No token provided.',
    });
  }
};

/**
 * Middleware: authorize
 * Purpose: Role-Based Access Control (RBAC).
 * Checks if the currently authenticated user's role is in the list of allowed roles.
 * Usage: router.get('/admin-only', protect, authorize('admin'), controllerFn);
 * 
 * @param  {...string} roles - Allowed roles (e.g., 'admin', 'user')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // req.user must already be populated by the `protect` middleware
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user ? req.user.role : 'anonymous'}' is not authorized to access this resource. Required: [${roles.join(', ')}]`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
