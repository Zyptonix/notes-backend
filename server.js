// ==============================================================================
// File: backend/server.js
// Purpose: Express Application Entry Point & Server Initialization
// ==============================================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// 1. Load environment variables from .env file
dotenv.config();

// 2. Connect to MongoDB database
connectDB();

// 3. Initialize Express application
const app = express();

// 4. Global Middlewares
// Enable Cross-Origin Resource Sharing (CORS) for all frontend clients (Vercel, localhost, etc.)
app.use(cors({
  origin: true, // Automatically reflects caller origin, resolving any mixed origin restrictions
  credentials: true,
}));

// Parse incoming JSON payloads in request body
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// 5. Mount API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));

// 6. Health Check / Root Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'Secure Note-Taking Backend API',
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the Secure Note-Taking REST API',
    documentation: {
      auth: '/api/auth',
      notes: '/api/notes',
      users: '/api/users',
      posts: '/api/posts',
      aggregations: {
        scenario1_groupByInterests: 'GET /api/users/grouped-by-interests',
        scenario2_userPostsLookup: 'GET /api/users/:userId/posts or GET /api/posts/user/:userId',
      },
    },
  });
});

// 7. 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// 8. Centralized Error Handler Middleware (Must be last middleware mounted)
app.use(errorHandler);

// 9. Start HTTP Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server Running]: Port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Handle unhandled Promise rejections gracefully
process.on('unhandledRejection', (err) => {
  console.error(`[Unhandled Rejection]: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
