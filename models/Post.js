// ==============================================================================
// File: backend/models/Post.js
// Purpose: Post schema for public posts and Aggregation Scenario 2 ($lookup)
// ==============================================================================

const mongoose = require('mongoose');

// 1. Define Post Schema
const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
    },
    // Reference to User who created the post
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Post must have an author'],
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
 * INDEX 1: Author Index (Compound with createdAt)
 * - Query / Aggregation Supported: Scenario 2 - User Posts ($lookup)
 *   When running:
 *   User.aggregate([
 *     { $match: { _id: userId } },
 *     { $lookup: { from: 'posts', localField: '_id', foreignField: 'author', as: 'posts' } }
 *   ])
 * - Why needed: In a $lookup stage, MongoDB executes a lookup on the foreign collection
 *   (posts) matching foreignField ('author') to localField ('_id'). Without this index,
 *   MongoDB would perform a full collection scan (COLLSCAN) on posts for every joined document!
 *   This index guarantees the $lookup operation executes via an index scan (IXSCAN).
 */
postSchema.index({ author: 1, createdAt: -1 });

/**
 * INDEX 2: CreatedAt Index for Public Feed Listing
 * - Query Supported: GET /api/posts (Listing all public posts sorted by newest first)
 *   Post.find().sort({ createdAt: -1 }).skip(...).limit(...)
 * - Why needed: Posts are visible to everyone. When paginating public posts, this index
 *   allows MongoDB to traverse pre-ordered documents without buffering in memory.
 */
postSchema.index({ createdAt: -1 });

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
