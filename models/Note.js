// ==============================================================================
// File: backend/models/Note.js
// Purpose: Note schema with ownership, timestamps, and optimized indexing
// ==============================================================================

const mongoose = require('mongoose');

// 1. Define Note Schema
const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    content: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true,
    },
    // Reference to the User model who owns this note
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Note must belong to an owner'],
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// ==============================================================================
// 2. EXPLICIT DATABASE INDEXES (As required by PDF Section 4 & Critical Constraint)
// ==============================================================================

/**
 * INDEX 1: Compound Index for User Note Listing (ESR Rule: Equality -> Sort)
 * - Query Supported: GET /api/notes for standard users:
 *   Note.find({ owner: req.user._id }).sort({ createdAt: -1 }).skip(...).limit(...)
 * - Why needed: Compound index on { owner: 1, createdAt: -1 } allows MongoDB to:
 *   1. Filter directly to documents matching `owner` (Equality)
 *   2. Retrieve them in pre-sorted order by `createdAt` descending (Sort) without
 *      needing an expensive in-memory sort operation.
 */
noteSchema.index({ owner: 1, createdAt: -1 });

/**
 * INDEX 2: CreatedAt Index for Admin Listing All Notes
 * - Query Supported: GET /api/notes for admin users:
 *   Note.find().sort({ createdAt: -1 }).skip(...).limit(...)
 * - Why needed: An admin views *everyone's* notes sorted by creation date.
 *   Because this query does NOT filter by `owner`, the compound index above
 *   cannot be used (MongoDB requires the index prefix).
 *   This index on { createdAt: -1 } allows the admin list to be paginated and sorted
 *   directly using the index without blocking in-memory sorts.
 */
noteSchema.index({ createdAt: -1 });

// Note on Single Note Read: Note.findById(id) or Note.findOne({ _id, owner })
// is automatically supported by MongoDB's default unique primary index on {_id: 1}.
// No redundant index is created to satisfy the "DO NOT MAKE ANY UNNECESSARY INDEXES" constraint.

const Note = mongoose.model('Note', noteSchema);
module.exports = Note;
