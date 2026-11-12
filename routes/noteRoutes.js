// ==============================================================================
// File: backend/routes/noteRoutes.js
// Purpose: Note management API routes with JWT protection and RBAC
// ==============================================================================

const express = require('express');
const router = express.Router();
const {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
} = require('../controllers/noteController');
const { protect } = require('../middleware/auth');

// All note routes require authentication
router.use(protect);

router.route('/')
  .post(createNote) // Create a note (owner = req.user._id)
  .get(getNotes);   // List notes with pagination (User sees own, Admin sees all)

router.route('/:id')
  .get(getNoteById) // Read single note (supported by default _id index)
  .put(updateNote)  // Update note
  .delete(deleteNote); // Delete note

module.exports = router;
