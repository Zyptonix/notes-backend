// ==============================================================================
// File: backend/middleware/errorHandler.js
// Purpose: Centralized Express error-handling middleware
// ==============================================================================

/**
 * Global Express error handling middleware.
 * Catches any error passed down via next(err) or thrown asynchronously.
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for developers
  console.error('[Error Details]:', err);

  // 1. Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Resource not found with id: ${err.value}`;
    return res.status(404).json({ success: false, message });
  }

  // 2. Mongoose Duplicate Key Error (Code 11000) - e.g., duplicate email
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value entered for '${field}'. This value already exists.`;
    return res.status(400).json({ success: false, message });
  }

  // 3. Mongoose Schema Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    return res.status(400).json({ success: false, message });
  }

  // 4. Fallback for generic or unhandled server errors
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
  });
};

module.exports = errorHandler;
