// ==============================================================================
// File: backend/config/db.js
// Purpose: MongoDB database connection management using Mongoose
// ==============================================================================

const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the URI provided in the environment variables.
 * Mongoose automatically handles connection pooling and reconnect logic.
 */
const connectDB = async () => {
  try {
    // Attempt connection with options
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`[MongoDB Connected]: Host -> ${conn.connection.host}, Database -> ${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB Connection Error]: ${error.message}`);
    // Exit process with failure code (1) if database cannot be reached
    process.exit(1);
  }
};

module.exports = connectDB;
