// ==============================================================================
// File: backend/routes/postRoutes.js
// Purpose: Posts routes & Aggregation Scenario 2
// ==============================================================================

const express = require('express');
const router = express.Router();
const {
  createPost,
  getPosts,
  getPostById,
  getPostsByUserViaLookup,
} = require('../controllers/postController');
const { protect } = require('../middleware/auth');

// Public route: Retrieve all posts belonging to a user using $lookup aggregation
router.get('/user/:userId', getPostsByUserViaLookup);

// Public route: Paginated list of all posts
router.get('/', getPosts);

// Public route: Single post
router.get('/:id', getPostById);

// Protected route: Create post
router.post('/', protect, createPost);

module.exports = router;
