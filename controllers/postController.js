// ==============================================================================
// File: backend/controllers/postController.js
// Purpose: Posts management & Aggregation Scenario 2 ($lookup)
// ==============================================================================

const mongoose = require('mongoose');
const Post = require('../models/Post');

/**
 * @desc    Create a new public post
 * @route   POST /api/posts
 * @access  Private (Authenticated users can create posts)
 */
exports.createPost = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both title and content for the post.',
      });
    }

    const post = await Post.create({
      title,
      content,
      author: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all public posts with pagination
 *          Uses index { createdAt: -1 }
 * @route   GET /api/posts
 * @access  Public (These posts are visible to everyone)
 */
exports.getPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const total = await Post.countDocuments();

    // Query uses { createdAt: -1 } index for sorted pagination
    const posts = await Post.find()
      .populate('author', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      count: posts.length,
      data: posts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single post by ID
 *          Uses default primary index {_id: 1}
 * @route   GET /api/posts/:id
 * @access  Public
 */
exports.getPostById = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name email role');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: `Post not found with id: ${req.params.id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================================
 * AGGREGATION SCENARIO 2: Retrieve all posts belonging to a particular user
 * ============================================================================
 * PDF Requirement:
 * - Context: Users can write posts which are stored in a separate Posts collection.
 *   These posts are visible to everyone.
 * - Task: Retrieve all posts belonging to a particular user.
 * - Constraint: Use a single aggregation pipeline with a $lookup stage.
 * - Indexing: Supported by index on Post: { author: 1, createdAt: -1 }.
 * ============================================================================
 * @desc    Retrieve all posts belonging to a user using single $lookup aggregation
 * @route   GET /api/posts/user/:userId
 * @access  Public
 */
exports.getPostsByUserViaLookup = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid User ID: ${userId}`,
      });
    }

    // Single aggregation pipeline starting from Post collection with $lookup stage to users
    const posts = await Post.aggregate([
      // STAGE 1: Match posts written by the target user ID
      // Index used: { author: 1, createdAt: -1 } (Compound Index)
      {
        $match: {
          author: new mongoose.Types.ObjectId(userId),
        },
      },

      // STAGE 2: $sort by createdAt descending (supported by the second part of compound index)
      {
        $sort: { createdAt: -1 },
      },

      // STAGE 3: $lookup stage to join author profile information from the 'users' collection
      {
        $lookup: {
          from: 'users', // MongoDB collection name for User model
          localField: 'author',
          foreignField: '_id',
          as: 'authorDetails',
        },
      },

      // STAGE 4: $unwind authorDetails array into a single object
      {
        $unwind: '$authorDetails',
      },

      // STAGE 5: $project to shape output cleanly and protect sensitive fields (password)
      {
        $project: {
          _id: 1,
          title: 1,
          content: 1,
          createdAt: 1,
          updatedAt: 1,
          author: {
            _id: '$authorDetails._id',
            name: '$authorDetails.name',
            email: '$authorDetails.email',
            role: '$authorDetails.role',
            interests: '$authorDetails.interests',
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: posts.length,
      data: posts,
    });
  } catch (error) {
    next(error);
  }
};
