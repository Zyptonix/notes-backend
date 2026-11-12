// ==============================================================================
// File: backend/controllers/authController.js
// Purpose: Authentication controller: Register, Login, Current User Profile
// ==============================================================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Helper: Generate JWT Token with payload containing user ID and role
 * @param {string} id - User ObjectId string
 * @param {string} role - User role ('user' | 'admin')
 * @returns {string} Signed JWT token string
 */
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, interests } = req.body;

    // 1. Check if user with this email already exists
    // (Uses the indexed 'email' field: IXSCAN)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    // 2. Parse interests: convert comma-separated string to array if necessary
    let interestsArray = [];
    if (Array.isArray(interests)) {
      interestsArray = interests.map((i) => i.trim().toLowerCase()).filter(Boolean);
    } else if (typeof interests === 'string' && interests.trim().length > 0) {
      interestsArray = interests.split(',').map((i) => i.trim().toLowerCase()).filter(Boolean);
    }

    // 3. Create the user in MongoDB
    // Note: Password hashing occurs automatically via userSchema.pre('save')
    const user = await User.create({
      name,
      email,
      password,
      role: role === 'admin' ? 'admin' : 'user', // Default to 'user' unless admin specified
      interests: interestsArray,
    });

    // 4. Generate JWT
    const token = generateToken(user._id, user.role);

    // 5. Send response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        interests: user.interests,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    // 2. Find user by email, explicitly requesting the hidden password field (+password)
    // Query uses the unique index on { email: 1 }
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.',
      });
    }

    // 3. Compare candidate password with stored bcrypt hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.',
      });
    }

    // 4. Generate JWT
    const token = generateToken(user._id, user.role);

    // 5. Return token and user profile
    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        interests: user.interests,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently logged-in user profile
 * @route   GET /api/auth/me
 * @access  Private (Requires JWT via 'protect' middleware)
 */
exports.getMe = async (req, res, next) => {
  try {
    // req.user was populated by the protect middleware
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};
