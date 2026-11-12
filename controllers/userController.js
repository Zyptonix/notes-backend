// ==============================================================================
// File: backend/controllers/userController.js
// Purpose: User management (Admin CRUD) & Aggregation Scenario 1 (Group by Interests)
// ==============================================================================

const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * ============================================================================
 * AGGREGATION SCENARIO 1: Group by Interests
 * ============================================================================
 * PDF Requirement:
 * - Context: User profiles contain a list of interests (e.g., ['chess', 'reading']).
 * - Task: Specific view to see users grouped by interests.
 * - Constraint: You must use EXACTLY ONE collection.aggregate() call.
 *               Do not use any other methods.
 * - Indexing: Supported by the multikey index on User: { interests: 1 }.
 * ============================================================================
 * @desc    Get users grouped by interests using a single aggregation pipeline
 * @route   GET /api/users/grouped-by-interests
 * @access  Private (All authenticated users can view this community aggregation)
 */
exports.getUsersGroupedByInterests = async (req, res, next) => {
  try {
    // EXACTLY ONE User.aggregate() call, fulfilling the constraint strictly:
    const groupedUsers = await User.aggregate([
      // STAGE 1: Filter out documents where interests array is null, empty, or missing
      // Uses the multikey index { interests: 1 } to match valid documents.
      {
        $match: {
          interests: { $exists: true, $type: 'array', $ne: [] },
        },
      },

      // STAGE 2: $unwind - Deconstruct the interests array.
      // Each user document with N interests produces N individual pipeline documents,
      // one for each interest.
      {
        $unwind: '$interests',
      },

      // STAGE 3: $group - Group documents by the unwound interest string.
      // Collect all users who share this interest into an array using $push.
      {
        $group: {
          _id: '$interests', // Group key: each unique interest (e.g., 'chess', 'reading')
          userCount: { $sum: 1 }, // Total count of users who have this interest
          users: {
            $push: {
              _id: '$_id',
              name: '$name',
              email: '$email',
              role: '$role',
            },
          },
        },
      },

      // STAGE 4: $sort - Sort the interests alphabetically by interest name (_id)
      {
        $sort: { _id: 1 },
      },

      // STAGE 5: $project - Format the output document cleanly
      {
        $project: {
          _id: 0,
          interest: '$_id',
          userCount: 1,
          users: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: groupedUsers.length,
      data: groupedUsers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================================
 * AGGREGATION SCENARIO 2: User Posts ($lookup) - Available on User Controller
 * ============================================================================
 * PDF Requirement:
 * - Context: Users can write posts which are stored in a separate Posts collection.
 *   These posts are visible to everyone.
 * - Task: Retrieve all posts belonging to a particular user.
 * - Constraint: Use a single aggregation pipeline with a $lookup stage.
 * - Indexing: Supported by the compound index on Post: { author: 1, createdAt: -1 }.
 * ============================================================================
 * @desc    Retrieve all posts belonging to a user using a single $lookup aggregation pipeline
 * @route   GET /api/users/:userId/posts
 * @access  Public / Private
 */
exports.getUserPostsViaLookup = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Validate valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid User ID: ${userId}`,
      });
    }

    // Single aggregation pipeline on User with $lookup to posts collection
    const result = await User.aggregate([
      // STAGE 1: Match the specific user by their _id
      // Uses the default unique primary index {_id: 1}
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId),
        },
      },

      // STAGE 2: $lookup to join documents from 'posts' collection
      // Matches: posts.author == users._id
      // Supported by index on posts: { author: 1, createdAt: -1 }
      {
        $lookup: {
          from: 'posts', // The collection name in MongoDB (pluralized model name)
          localField: '_id',
          foreignField: 'author',
          as: 'posts',
        },
      },

      // STAGE 3: $project - Cleanly format the user output (excluding sensitive password)
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          interests: 1,
          createdAt: 1,
          postCount: { $size: '$posts' },
          posts: 1,
        },
      },
    ]);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: `User not found with id: ${userId}`,
      });
    }

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all users with pagination (Admin only)
 *          Uses index { createdAt: -1 } for fast sort/skip
 * @route   GET /api/users
 * @access  Private (Admin only)
 */
exports.getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();

    // Query uses the { createdAt: -1 } index for sorted retrieval
    const users = await User.find()
      .select('-password')
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
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single user by ID (Admin only)
 *          Uses default primary index {_id: 1}
 * @route   GET /api/users/:id
 * @access  Private (Admin only)
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with id: ${req.params.id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a user (Admin only)
 * @route   POST /api/users
 * @access  Private (Admin only)
 */
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, interests } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    let interestsArray = [];
    if (Array.isArray(interests)) {
      interestsArray = interests.map((i) => i.trim().toLowerCase()).filter(Boolean);
    } else if (typeof interests === 'string' && interests.trim().length > 0) {
      interestsArray = interests.split(',').map((i) => i.trim().toLowerCase()).filter(Boolean);
    }

    const user = await User.create({
      name,
      email,
      password: password || 'Password123!', // Fallback default password if omitted by admin
      role: role || 'user',
      interests: interestsArray,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully by admin',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        interests: user.interests,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a user (Admin only)
 * @route   PUT /api/users/:id
 * @access  Private (Admin only)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, interests } = req.body;

    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with id: ${req.params.id}`,
      });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (interests !== undefined) {
      if (Array.isArray(interests)) {
        user.interests = interests.map((i) => i.trim().toLowerCase()).filter(Boolean);
      } else if (typeof interests === 'string') {
        user.interests = interests.split(',').map((i) => i.trim().toLowerCase()).filter(Boolean);
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        interests: user.interests,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a user (Admin only)
 * @route   DELETE /api/users/:id
 * @access  Private (Admin only)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with id: ${req.params.id}`,
      });
    }

    // Prevent admin from deleting themselves accidentally
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Admin cannot delete their own account.',
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: {},
    });
  } catch (error) {
    next(error);
  }
};
