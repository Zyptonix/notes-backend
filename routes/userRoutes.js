// ==============================================================================
// File: backend/routes/userRoutes.js
// Purpose: User routes (Admin CRUD, Aggregation Scenario 1 & 2)
// ==============================================================================

const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUsersGroupedByInterests,
  getUserPostsViaLookup,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// 1. Aggregation Scenario 1: Group Users by Interests (Single aggregate() call)
// Route is protected so authenticated users can view community interest groups
router.get('/grouped-by-interests', protect, getUsersGroupedByInterests);

// 2. Aggregation Scenario 2: Retrieve all posts belonging to a user using $lookup
router.get('/:userId/posts', getUserPostsViaLookup);

// 3. Admin User Management CRUD (Strictly protected and restricted to 'admin')
router.use(protect);
router.use(authorize('admin'));

router.route('/')
  .get(getUsers)       // Admin: List all users with pagination
  .post(createUser);   // Admin: Add new user

router.route('/:id')
  .get(getUserById)    // Admin: Get single user details
  .put(updateUser)     // Admin: Update user
  .delete(deleteUser); // Admin: Remove user

module.exports = router;
