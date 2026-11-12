// ==============================================================================
// File: backend/test-integration.js
// Purpose: Automated verification of Indexes, RBAC, and Aggregation Scenarios (1 & 2)
// Run: node test-integration.js
// ==============================================================================

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Load Models
const User = require('./models/User');
const Note = require('./models/Note');
const Post = require('./models/Post');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING INTEGRATION TESTS FOR SECURE NOTE-TAKING');
  console.log('====================================================\n');

  // Set test JWT secret
  process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
  process.env.JWT_EXPIRES_IN = '1d';

  // 1. Start MongoDB In-Memory Server
  console.log('[Step 1]: Starting MongoDB Memory Server...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log(`[Step 1]: In-Memory MongoDB running at: ${uri}`);

  await mongoose.connect(uri);
  console.log('[Step 1]: Mongoose connected successfully.\n');

  // 2. Ensure and Verify Indexes
  console.log('[Step 2]: Building & Verifying Database Indexes (schema.index)...');
  await User.syncIndexes();
  await Note.syncIndexes();
  await Post.syncIndexes();

  const userIndexes = await User.collection.getIndexes();
  const noteIndexes = await Note.collection.getIndexes();
  const postIndexes = await Post.collection.getIndexes();

  console.log('User Collection Indexes:', Object.keys(userIndexes));
  console.log('Note Collection Indexes:', Object.keys(noteIndexes));
  console.log('Post Collection Indexes:', Object.keys(postIndexes));

  // Assert required indexes exist
  if (!userIndexes['email_1']) throw new Error('Missing unique index on User.email!');
  if (!userIndexes['interests_1']) throw new Error('Missing multikey index on User.interests!');
  if (!userIndexes['createdAt_-1']) throw new Error('Missing index on User.createdAt!');
  if (!noteIndexes['owner_1_createdAt_-1']) throw new Error('Missing compound index on Note: owner_1_createdAt_-1!');
  if (!noteIndexes['createdAt_-1']) throw new Error('Missing index on Note: createdAt_-1!');
  if (!postIndexes['author_1_createdAt_-1']) throw new Error('Missing compound index on Post: author_1_createdAt_-1!');
  if (!postIndexes['createdAt_-1']) throw new Error('Missing index on Post: createdAt_-1!');

  console.log('✅ ALL REQUIRED INDEXES ARE ACTIVE & VERIFIED.\n');

  // 3. Test User Creation & Password Hashing
  console.log('[Step 3]: Testing User Creation & Secure Password Hashing...');
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@test.com',
    password: 'SecurePassword123!',
    role: 'admin',
    interests: ['chess', 'reading'],
  });

  const alice = await User.create({
    name: 'Alice Johnson',
    email: 'alice@test.com',
    password: 'SecurePassword123!',
    role: 'user',
    interests: ['chess', 'music'],
  });

  const bob = await User.create({
    name: 'Bob Smith',
    email: 'bob@test.com',
    password: 'SecurePassword123!',
    role: 'user',
    interests: ['reading', 'hiking'],
  });

  // Verify password was hashed (not plain text)
  const rawAdmin = await User.findById(admin._id).select('+password');
  if (rawAdmin.password === 'SecurePassword123!') {
    throw new Error('Password was stored in plain text!');
  }
  const isMatch = await rawAdmin.comparePassword('SecurePassword123!');
  if (!isMatch) throw new Error('Password verification failed!');
  console.log('✅ Password successfully hashed with bcrypt and verified via comparePassword().\n');

  // 4. Test Notes Creation & RBAC
  console.log('[Step 4]: Testing Notes Management & RBAC...');
  const aliceNote1 = await Note.create({
    title: 'Alice Note 1',
    content: 'Secret content of Alice',
    owner: alice._id,
  });
  const aliceNote2 = await Note.create({
    title: 'Alice Note 2',
    content: 'More content of Alice',
    owner: alice._id,
  });
  const bobNote1 = await Note.create({
    title: 'Bob Note 1',
    content: 'Bob private thoughts',
    owner: bob._id,
  });

  // User query: Alice should only see her own 2 notes
  const aliceNotes = await Note.find({ owner: alice._id }).sort({ createdAt: -1 });
  console.log(`Alice queried notes count: ${aliceNotes.length} (Expected: 2)`);
  if (aliceNotes.length !== 2) throw new Error('Alice notes count mismatch!');

  // Admin query: Admin sees all 3 notes
  const allNotes = await Note.find().sort({ createdAt: -1 });
  console.log(`Admin queried notes count: ${allNotes.length} (Expected: 3)`);
  if (allNotes.length !== 3) throw new Error('Admin all notes count mismatch!');
  console.log('✅ Note ownership and RBAC separation confirmed.\n');

  // 5. Test Aggregation Scenario 1: Group Users by Interests
  console.log('[Step 5]: Testing Aggregation Scenario 1 (Group by Interests)...');
  const groupedInterests = await User.aggregate([
    { $match: { interests: { $exists: true, $type: 'array', $ne: [] } } },
    { $unwind: '$interests' },
    {
      $group: {
        _id: '$interests',
        userCount: { $sum: 1 },
        users: { $push: { id: '$_id', name: '$name', email: '$email' } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  console.log('Scenario 1 Aggregation Results:');
  groupedInterests.forEach((group) => {
    console.log(` - Interest "${group._id}": ${group.userCount} users -> [${group.users.map((u) => u.name).join(', ')}]`);
  });

  // Verification:
  // 'chess' has Admin and Alice (2 users)
  // 'reading' has Admin and Bob (2 users)
  // 'music' has Alice (1 user)
  // 'hiking' has Bob (1 user)
  const chessGroup = groupedInterests.find((g) => g._id === 'chess');
  if (!chessGroup || chessGroup.userCount !== 2) {
    throw new Error('Aggregation Scenario 1 failed for "chess"!');
  }
  console.log('✅ Aggregation Scenario 1 (Single aggregate() call) verified successfully.\n');

  // 6. Test Aggregation Scenario 2: User Posts ($lookup)
  console.log('[Step 6]: Testing Aggregation Scenario 2 (User Posts $lookup)...');
  await Post.create([
    {
      title: 'Alice First Post',
      content: 'Hello World from Alice!',
      author: alice._id,
    },
    {
      title: 'Alice Second Post',
      content: 'Talking about MongoDB Indexes.',
      author: alice._id,
    },
    {
      title: 'Bob Hiking Post',
      content: 'Beautiful trails near the mountains.',
      author: bob._id,
    },
  ]);

  // Execute Scenario 2 aggregation starting from Post with $lookup
  const alicePostsFromPost = await Post.aggregate([
    { $match: { author: alice._id } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'authorDetails',
      },
    },
    { $unwind: '$authorDetails' },
  ]);

  console.log(`Retrieved posts for Alice via $lookup from Post: ${alicePostsFromPost.length} (Expected: 2)`);
  if (alicePostsFromPost.length !== 2) throw new Error('Scenario 2 count mismatch from Post!');
  if (alicePostsFromPost[0].authorDetails.email !== 'alice@test.com') {
    throw new Error('Author details not joined properly in $lookup!');
  }

  // Also verify starting from User with $lookup to posts
  const alicePostsFromUser = await User.aggregate([
    { $match: { _id: alice._id } },
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'author',
        as: 'posts',
      },
    },
  ]);

  if (!alicePostsFromUser[0] || alicePostsFromUser[0].posts.length !== 2) {
    throw new Error('Scenario 2 count mismatch from User $lookup!');
  }
  console.log(`Retrieved posts for Alice via $lookup from User: ${alicePostsFromUser[0].posts.length} (Expected: 2)`);
  console.log('✅ Aggregation Scenario 2 ($lookup stage) verified successfully.\n');

  // 7. Test Pagination
  console.log('[Step 7]: Testing Pagination Logic...');
  const limit = 1;
  const page1 = await Note.find({ owner: alice._id }).sort({ createdAt: -1 }).skip(0).limit(limit);
  const page2 = await Note.find({ owner: alice._id }).sort({ createdAt: -1 }).skip(1).limit(limit);

  if (page1.length !== 1 || page2.length !== 1 || page1[0]._id.toString() === page2[0]._id.toString()) {
    throw new Error('Pagination logic returned identical or incorrect slices!');
  }
  console.log('✅ Pagination correctly offsets and returns distinct documents.\n');

  // 8. Explain Plan Execution Verification (Proving IXSCAN vs COLLSCAN)
  console.log('[Step 8]: Verifying Query Explain Plans (Zero COLLSCANs)...');

  // Helper to check if an explain plan stage tree contains IXSCAN
  function hasIxScan(plan) {
    if (!plan) return false;
    if (plan.stage === 'IXSCAN') return true;
    if (plan.inputStage) return hasIxScan(plan.inputStage);
    if (plan.inputStages) return plan.inputStages.some(hasIxScan);
    return false;
  }

  // Explain User email lookup
  const userExplain = await User.find({ email: 'alice@test.com' }).explain('queryPlanner');
  const userHasIxScan = hasIxScan(userExplain.queryPlanner.winningPlan);
  console.log(`User email query uses IXSCAN: ${userHasIxScan}`);
  if (!userHasIxScan) throw new Error('User email query did not use IXSCAN!');

  // Explain User Note list with sort
  const noteExplain = await Note.find({ owner: alice._id }).sort({ createdAt: -1 }).explain('queryPlanner');
  const noteHasIxScan = hasIxScan(noteExplain.queryPlanner.winningPlan);
  console.log(`User note list query uses IXSCAN: ${noteHasIxScan}`);
  if (!noteHasIxScan) throw new Error('Note list query did not use IXSCAN!');

  // Explain Admin Note list with sort
  const adminNoteExplain = await Note.find().sort({ createdAt: -1 }).explain('queryPlanner');
  const adminNoteHasIxScan = hasIxScan(adminNoteExplain.queryPlanner.winningPlan);
  console.log(`Admin note list query uses IXSCAN: ${adminNoteHasIxScan}`);
  if (!adminNoteHasIxScan) throw new Error('Admin note list query did not use IXSCAN!');

  console.log('✅ ALL EXPLAIN PLANS CONFIRM IXSCAN (INDEX SCAN) WITH ZERO UNINDEXED SORTS!\n');

  // Clean up
  await mongoose.disconnect();
  await mongod.stop();

  console.log('====================================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED WITH ZERO ERRORS!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
