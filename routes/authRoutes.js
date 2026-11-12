// ==============================================================================
// File: backend/routes/authRoutes.js
// Purpose: Authentication API routes (Register, Login, Me)
// ==============================================================================

const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes (Requires valid JWT)
router.get('/me', protect, getMe);

module.exports = router;
