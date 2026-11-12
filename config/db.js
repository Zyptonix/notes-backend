// ==============================================================================
// File: backend/config/db.js
// Purpose: MongoDB database connection management using Mongoose
// ==============================================================================

const dns = require('dns');
// Set public DNS servers to resolve MongoDB Atlas SRV records reliably (fixes querySrv ECONNREFUSED)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if not permitted
}

const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the URI provided in the environment variables.
 * Mongoose automatically handles connection pooling and reconnect logic.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('\n❌ [MongoDB Error]: MONGODB_URI is not defined in your environment variables.');
    console.error('👉 Please create a `.env` file inside the `backend/` directory with:');
    console.error('   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/note_taking_db\n');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB Connected]: Host -> ${conn.connection.host}, Database -> ${conn.connection.name}`);
  } catch (error) {
    console.error(`\n❌ [MongoDB Connection Error]: ${error.message}`);
    console.error('👉 Please verify your connection string in backend/.env:');
    console.error('   - For MongoDB Atlas: verify your username, password, and that IP 0.0.0.0/0 is whitelisted in Network Access.');
    console.error('   - For local MongoDB: ensure your mongod service is started and listening on port 27017.\n');
    process.exit(1);
  }
};

module.exports = connectDB;
