// ==============================================================================
// File: backend/models/User.js
// Purpose: User schema with secure password hashing, roles, interests, and indexing
// ==============================================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. Define the User Schema structure
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      // select: false prevents the hashed password from being returned in general queries
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: '{VALUE} is not a valid role. Allowed roles: user, admin',
      },
      default: 'user', // Default role for standard registrations
    },
    interests: {
      type: [String],
      default: [], // Array of interests, e.g., ['chess', 'reading']
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// ==============================================================================
// 2. EXPLICIT DATABASE INDEXES (As required by PDF Section 4 & Critical Constraint)
// "You must use the schema.index method for defining indexes in your code so they are visible during review."
// ==============================================================================

/**
 * INDEX 1: Email Index (Unique)
 * - Query Supported: Fast user lookup during authentication (POST /api/auth/login)
 *   and preventing duplicate email registrations.
 * - Why needed: MongoDB default is a full collection scan (COLLSCAN) for unindexed fields.
 *   This index converts login lookups into an O(log N) B-Tree lookup (IXSCAN).
 */
userSchema.index({ email: 1 }, { unique: true });

/**
 * INDEX 2: Multikey Index on Interests
 * - Aggregation Supported: Scenario 1 - Group users by interests via aggregation pipeline.
 * - Why needed: When indexing an array field in MongoDB, it creates a "multikey index".
 *   Each element in the array gets its own index entry, allowing MongoDB to efficiently
 *   filter, scan, or group documents by array elements without examining entire documents.
 */
userSchema.index({ interests: 1 });

/**
 * INDEX 3: CreatedAt Index for List Operations
 * - Query Supported: Admin listing all users with pagination (GET /api/users)
 *   sorted by creation date (newest first: { createdAt: -1 }).
 * - Why needed: Without this index, sorting large sets of users requires an in-memory
 *   sort buffer (blocking sort). With this index, MongoDB reads sorted keys directly.
 */
userSchema.index({ createdAt: -1 });

// Note: We deliberately do NOT create an index on _id because MongoDB automatically
// creates a primary unique index on {_id: 1} for every collection.

// ==============================================================================
// 3. MONGOOSE PRE-SAVE HOOK (Password Hashing)
// "Security: Implement secure password hashing."
// ==============================================================================
userSchema.pre('save', async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return;
  }

  // Generate salt with cost factor of 10 rounds (standard industry practice)
  const salt = await bcrypt.genSalt(10);
  // Hash password with generated salt
  this.password = await bcrypt.hash(this.password, salt);
});

// ==============================================================================
// 4. INSTANCE METHOD: Verify Password
// ==============================================================================
userSchema.methods.comparePassword = async function (candidatePassword) {
  // Compare candidate plain text password with stored bcrypt hash
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
